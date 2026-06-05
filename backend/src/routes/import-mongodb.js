import express from 'express';
import fileUpload from 'express-fileupload';
import yauzl from 'yauzl';
import pdf from 'pdf-parse';
import * as db from '../services/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { processForm16 } from '../services/pdfProcessor.js';
import { generateAIAnalysis } from '../services/aiService.js';
import { generateUUID } from '../utils/uuid.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

// Get all import jobs
router.get('/jobs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const jobs = await db.getImportJobs(0, 10000);
    res.json(jobs);
  } catch (error) {
    console.error('Get import jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch import jobs' });
  }
});

// Get single import job
router.get('/jobs/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const job = await db.getImportJob(new ObjectId(id));
    
    if (!job) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get import job error:', error);
    res.status(500).json({ error: 'Failed to fetch import job' });
  }
});

// Get import job logs
router.get('/jobs/:id/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await db.getImportJobLogs(id);
    res.json(logs);
  } catch (error) {
    console.error('Get import logs error:', error);
    res.status(500).json({ error: 'Failed to fetch import logs' });
  }
});

// Upload and process ZIP or single PDF
router.post('/upload',
  authenticateToken,
  requireAdmin,
  fileUpload({ limits: { fileSize: 500 * 1024 * 1024 } }),
  auditLog('upload', 'import'),
  async (req, res) => {
    try {
      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let { documentType } = req.body;
      const file = req.files.file;

      // Validate file size
      if (file.size === 0) {
        return res.status(400).json({ error: 'Uploaded file is empty' });
      }

      // Default document type to FORM16 if not provided
      if (!documentType) {
        documentType = 'FORM16';
      }

      // Create upload directory
      const uploadDir = path.join(process.cwd(), 'uploads', 'imports');
      await fs.mkdir(uploadDir, { recursive: true });

      const savedPath = path.join(uploadDir, `${Date.now()}_${file.name}`);
      await file.mv(savedPath);

      // Verify file was actually saved
      try {
        const stats = await fs.stat(savedPath);
        if (stats.size !== file.size) {
          throw new Error(`File size mismatch. Expected: ${file.size}, Got: ${stats.size}`);
        }

        // Additional check for ZIP files - verify they have proper end marker
        const isZip = file.name.toLowerCase().endsWith('.zip');
        if (isZip && stats.size > 1000) {
          const fd = await fs.open(savedPath, 'r');
          const bufferSize = Math.min(65535 + 22, stats.size);
          const lastBuffer = Buffer.alloc(bufferSize);
          await fd.read(lastBuffer, 0, bufferSize, Math.max(0, stats.size - bufferSize));
          await fd.close();

          const endSignatureIndex = lastBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
          if (endSignatureIndex === -1) {
            throw new Error('ZIP file appears truncated - missing end of central directory record. Please re-upload.');
          }
        }
      } catch (verifyError) {
        try {
          await fs.unlink(savedPath);
        } catch (deleteErr) {
          console.error('Failed to delete incomplete file:', deleteErr.message);
        }
        return res.status(400).json({ error: verifyError.message || 'Failed to verify uploaded file' });
      }

      // Create import job (status pending)
      const jobId = new ObjectId();
      await db.createImportJob({
        _id: jobId,
        document_type: documentType || null,
        file_name: file.name,
        file_path: savedPath,
        uploaded_by: req.user.id,
        status: 'pending',
        created_at: new Date(),
      });

      // Decide processing mode: zip or single pdf
      const isZip = file.name.toLowerCase().endsWith('.zip');

      processImportJob(jobId, savedPath, documentType, isZip, req.user.id).catch(err => {
        console.error('Background processing error:', err);
      });

      res.json({ 
        message: 'Upload successful, processing started', 
        jobId: jobId.toString(),
        fileName: file.name,
        isZip,
        fileSize: file.size
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message || 'Upload failed' });
    }
  }
);

// NEW ENDPOINT: Scan ZIP and preview employees without importing
router.post('/preview',
  authenticateToken,
  requireAdmin,
  fileUpload({ limits: { fileSize: 500 * 1024 * 1024 } }),
  async (req, res) => {
    try {
      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = req.files.file;
      const uploadDir = path.join(process.cwd(), 'uploads', 'imports');
      await fs.mkdir(uploadDir, { recursive: true });

      const savedPath = path.join(uploadDir, `preview_${Date.now()}_${file.name}`);
      await file.mv(savedPath);

      try {
        const stats = await fs.stat(savedPath);
        if (stats.size !== file.size) {
          throw new Error('File size mismatch during upload');
        }

        // Extract and analyze PDFs to get employee list
        const isZip = file.name.toLowerCase().endsWith('.zip');
        let pdfFiles = [];

        if (isZip) {
          pdfFiles = await extractPDFsFromZip(savedPath, 'preview');
        } else {
          const data = await fs.readFile(savedPath);
          pdfFiles = [{ entryName: path.basename(savedPath), getData: () => data }];
        }

        // Scan PDFs to extract employee info
        const employees = {};
        const failedFiles = [];

        for (const entry of pdfFiles) {
          try {
            if (entry.entryName.includes('__MACOSX') || entry.entryName.startsWith('._')) {
              continue;
            }

            const pdfBuffer = entry.getData();
            if (!pdfBuffer || pdfBuffer.length === 0) continue;

            const pdfData = await pdf(pdfBuffer, { max: 0, version: 'v1.10.100' });
            const extractedData = processForm16(pdfData.text);
            try {
              const detectedPart = detectFormPartFromText(pdfData.text);
              if (detectedPart) extractedData.form_part = detectedPart;
            } catch (e) {
              // ignore detection errors
            }

            // Try to extract from filename if PDF parsing failed
            if (!extractedData.pan && entry.entryName) {
              const base = path.basename(entry.entryName, path.extname(entry.entryName));
              const parts = base.split(/[_\-\s]+/);
              for (const part of parts) {
                const cleaned = part.replace(/[^A-Za-z0-9]/g, '');
                if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(cleaned)) {
                  extractedData.pan = cleaned.toUpperCase();
                  break;
                }
              }
            }

            if (extractedData.pan) {
              if (!employees[extractedData.pan]) {
                employees[extractedData.pan] = {
                  pan: extractedData.pan,
                  name: extractedData.employee_name || 'Unknown',
                  year: extractedData.financial_year || extractedData.assessment_year || 'Unknown',
                  fileCount: 0,
                  files: []
                };
              }
              employees[extractedData.pan].fileCount++;
              employees[extractedData.pan].files.push(entry.entryName);
            } else {
              failedFiles.push({ file: entry.entryName, reason: 'Could not extract PAN' });
            }
          } catch (err) {
            failedFiles.push({ file: entry.entryName, reason: err.message });
          }
        }

        // Clean up preview file
        await fs.unlink(savedPath).catch(() => {});

        // Return employee list for selection
        res.json({
          success: true,
          employees: Object.values(employees).sort((a, b) => a.pan.localeCompare(b.pan)),
          totalEmployees: Object.keys(employees).length,
          totalPDFs: pdfFiles.length,
          failedPDFs: failedFiles.length,
          failed: failedFiles.slice(0, 10) // Show first 10 failed
        });
      } catch (error) {
        await fs.unlink(savedPath).catch(() => {});
        throw error;
      }
    } catch (error) {
      console.error('Preview error:', error);
      res.status(500).json({ error: error.message || 'Failed to preview file' });
    }
  }
);

// NEW ENDPOINT: Selective import for specific employees
router.post('/selective',
  authenticateToken,
  requireAdmin,
  fileUpload({ limits: { fileSize: 500 * 1024 * 1024 } }),
  auditLog('upload', 'import'),
  async (req, res) => {
    try {
      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = req.files.file;
      let { documentType, selectedPANs } = req.body;

      // Parse selectedPANs if it's a string
      if (typeof selectedPANs === 'string') {
        selectedPANs = JSON.parse(selectedPANs);
      }

      if (!Array.isArray(selectedPANs) || selectedPANs.length === 0) {
        return res.status(400).json({ error: 'No employees selected for import' });
      }

      // Validate file
      if (file.size === 0) {
        return res.status(400).json({ error: 'Uploaded file is empty' });
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'imports');
      await fs.mkdir(uploadDir, { recursive: true });

      const savedPath = path.join(uploadDir, `${Date.now()}_${file.name}`);
      await file.mv(savedPath);

      // Verify and validate
      try {
        const stats = await fs.stat(savedPath);
        if (stats.size !== file.size) {
          throw new Error('File size mismatch during upload');
        }

        // ZIP validation for large files
        const isZip = file.name.toLowerCase().endsWith('.zip');
        if (isZip && stats.size > 1000) {
          const fd = await fs.open(savedPath, 'r');
          const bufferSize = Math.min(65535 + 22, stats.size);
          const lastBuffer = Buffer.alloc(bufferSize);
          await fd.read(lastBuffer, 0, bufferSize, Math.max(0, stats.size - bufferSize));
          await fd.close();

          const endSignatureIndex = lastBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
          if (endSignatureIndex === -1) {
            throw new Error('ZIP file appears truncated - missing end of central directory record. Please re-upload.');
          }
        }
      } catch (verifyError) {
        await fs.unlink(savedPath).catch(() => {});
        return res.status(400).json({ error: verifyError.message || 'Failed to verify uploaded file' });
      }

      // Create selective import job
      const jobId = new ObjectId();
      await db.createImportJob({
        _id: jobId,
        document_type: documentType || null,
        file_name: file.name,
        file_path: savedPath,
        uploaded_by: req.user.id,
        status: 'pending',
        filter_pans: selectedPANs,
        created_at: new Date(),
      });

      // Start selective processing
      const isZip = file.name.toLowerCase().endsWith('.zip');
      processSelectiveImportJob(jobId, savedPath, documentType, isZip, selectedPANs).catch(err => {
        console.error('Selective import background processing error:', err);
      });

      res.json({
        message: 'Selective import started',
        jobId: jobId.toString(),
        fileName: file.name,
        selectedEmployees: selectedPANs.length,
        fileSize: file.size
      });
    } catch (error) {
      console.error('Selective import error:', error);
      res.status(500).json({ error: error.message || 'Selective import failed' });
    }
  }
);

// Helper function to extract PDFs from ZIP using streaming
async function extractPDFsFromZip(zipPath, jobId) {
  return new Promise((resolve, reject) => {
    const pdfFiles = [];

    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        return reject(new Error(`Failed to open ZIP: ${err.message}`));
      }

      let entryCount = 0;
      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        entryCount++;

        // Skip directories and macOS metadata
        if (entry.fileName.endsWith('/') || entry.fileName.includes('__MACOSX') || entry.fileName.startsWith('._')) {
          zipfile.readEntry();
          return;
        }

        // Process PDF files
        if (entry.fileName.toLowerCase().endsWith('.pdf')) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error(`[Import ${jobId}] Failed to read entry ${entry.fileName}:`, err.message);
              zipfile.readEntry();
              return;
            }

            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              const buffer = Buffer.concat(chunks);
              pdfFiles.push({
                entryName: entry.fileName,
                getData: () => buffer,
              });
              zipfile.readEntry();
            });
            readStream.on('error', (err) => {
              console.error(`[Import ${jobId}] Stream error for ${entry.fileName}:`, err.message);
              zipfile.readEntry();
            });
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        console.log(`[Import ${jobId}] ZIP entries processed: ${entryCount}, PDFs found: ${pdfFiles.length}`);
        resolve(pdfFiles);
      });

      zipfile.on('error', (err) => {
        const errorMsg = err.message || String(err);
        
        let userMessage = 'Failed to process ZIP file';
        if (errorMsg.includes('not found') || errorMsg.includes('truncated')) {
          userMessage = 'ZIP file is corrupted or incomplete. Please re-upload the file.';
        } else if (errorMsg.includes('signature')) {
          userMessage = 'Invalid ZIP file format. Not a valid ZIP archive.';
        }
        
        reject(new Error(userMessage));
      });
    });
  });
}

// Heuristic: detect whether a parsed PDF text belongs to Part A or Part B
function detectFormPartFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.replace(/\s+/g, ' ').toUpperCase();

  // Strong signals
  if (/FORM\s*16[^A-Z0-9]{0,50}PART[\s\-]*A/.test(t) || /\bPART[\s\-]*A\b/.test(t)) {
    return 'partA';
  }
  if (/FORM\s*16[^A-Z0-9]{0,50}PART[\s\-]*B/.test(t) || /\bPART[\s\-]*B\b/.test(t)) {
    return 'partB';
  }

  // Some PDFs use headings like "Part A - Details of Tax" or simply contain key phrases
  if (/DETAILS OF TAX|DETAILS OF TAX DEDUCTED|TAX DEDUCTED AT SOURCE/.test(t) && /SALARY|INCOME FROM SALARY/.test(t)) {
    return 'partB';
  }

  return null;
}

// Background processing function
async function processImportJob(jobId, filePath, documentType, isZip = true, uploadedBy = null) {
  try {
    // Wait a bit to ensure file is fully written to disk
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify file exists and is readable
    try {
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        throw new Error('File was saved but is empty');
      }
      console.log(`[Import ${jobId}] Processing file: ${filePath} (${stats.size} bytes)`);
    } catch (statError) {
      throw new Error(`File not accessible after upload: ${statError.message}`);
    }

    // Update status to processing
    await db.updateImportJob(jobId, {
      status: 'processing',
      started_at: new Date(),
    });

    let pdfFiles = [];

    if (isZip) {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size === 0) {
          throw new Error('ZIP file is empty');
        }

        console.log(`[Import ${jobId}] Reading ZIP file (${stats.size} bytes)...`);

        // Validate ZIP header
        const headerBuffer = Buffer.alloc(4);
        const fd = await fs.open(filePath, 'r');
        await fd.read(headerBuffer, 0, 4, 0);
        await fd.close();

        // ZIP files should start with PK (0x50 0x4B)
        if (headerBuffer[0] !== 0x50 || headerBuffer[1] !== 0x4B) {
          console.error(`[Import ${jobId}] Invalid ZIP header. File starts with:`, headerBuffer.toString('hex'));
          throw new Error('Invalid ZIP file format. File does not start with ZIP signature (PK).');
        }

        console.log(`[Import ${jobId}] ZIP header valid, extracting entries using streaming...`);

        pdfFiles = await extractPDFsFromZip(filePath, jobId);
        
        if (pdfFiles.length === 0) {
          throw new Error('No PDF files found in ZIP archive');
        }

        console.log(`[Import ${jobId}] PDF files found: ${pdfFiles.length}`);
      } catch (zipError) {
        console.error(`[Import ${jobId}] ZIP processing error:`, zipError.message);
        throw zipError;
      }
    } else {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size === 0) {
          throw new Error('PDF file is empty');
        }

        const data = await fs.readFile(filePath);
        
        // Validate PDF header
        if (data[0] !== 0x25 || data[1] !== 0x50 || data[2] !== 0x44 || data[3] !== 0x46) { // %PDF
          console.error('Invalid PDF header. File starts with:', data.slice(0, 4).toString('hex'));
          throw new Error('Invalid PDF file format. File does not start with PDF signature.');
        }

        pdfFiles = [{ entryName: path.basename(filePath), getData: () => data }];
      } catch (pdfError) {
        console.error('PDF file validation error:', pdfError.message);
        throw pdfError;
      }
    }

    const totalFiles = pdfFiles.length;
    let processedFiles = 0;
    let successfulFiles = 0;
    let failedFiles = 0;
    let skippedFiles = 0;

    // Update total files
    await db.updateImportJob(jobId, { total_files: totalFiles });

    // Process each PDF
    for (const entry of pdfFiles) {
      try {
        console.log(`[Import ${jobId}] DEBUG RAW ENTRY: ${JSON.stringify({entryName: entry.entryName, hasSlash: entry.entryName.includes('/')})}`);
        
        // Skip macOS metadata files
        if (entry.entryName.includes('__MACOSX') || entry.entryName.startsWith('._')) {
          continue;
        }

        const pdfBuffer = entry.getData();
        
        // Validate PDF buffer
        if (!pdfBuffer || pdfBuffer.length === 0) {
          throw new Error('Empty PDF file');
        }

        // Try to parse PDF with multiple options
        let pdfData;
        try {
          pdfData = await pdf(pdfBuffer, {
            max: 0, // Parse all pages
            version: 'v1.10.100'
          });
        } catch (pdfError) {
          console.error(`PDF parse error for ${entry.entryName}:`, pdfError);
          throw new Error(`Invalid PDF format: ${pdfError.message}`);
        }

        const extractedData = processForm16(pdfData.text);
        // Prefer content-based form part detection over filename heuristics
        try {
          const detectedPart = detectFormPartFromText(pdfData.text);
          if (detectedPart) extractedData.form_part = detectedPart;
        } catch (e) {
          // ignore
        }

        console.log(`[Import ${jobId}] ========== PROCESSING: ${entry.entryName} ==========`);
        console.log(`[Import ${jobId}] Extracted from PDF - financial_year: ${extractedData.financial_year}, assessment_year: ${extractedData.assessment_year}`);
        
        // Check if financial_year was extracted from PDF content
        if (!extractedData.financial_year && extractedData.assessment_year) {
          extractedData.financial_year = extractedData.assessment_year;
          console.log(`[Import ${jobId}] ✓ Using assessment_year: ${extractedData.assessment_year}`);
        } else if (extractedData.financial_year) {
          console.log(`[Import ${jobId}] ✓ Using financial_year: ${extractedData.financial_year}`);
        }
        
        // If still no year found → skip this file
        if (!extractedData.financial_year) {
          console.log(`[Import ${jobId}] WARNING: No financial year found in PDF! Will skip this file.`);
          extractedData.skip = true;
          extractedData.skipReason = 'No financial year found in PDF content';
        } else {
          console.log(`[Import ${jobId}] Using financial year from PDF: ${extractedData.financial_year}`);
        }

        // Auto-assign document type if not provided and parser indicates form16
        let docType = documentType;
        if (!docType) {
          docType = extractedData.is_form16 ? 'form16' : 'unknown';
        }

        // If filename contains form16, prefer that
        if (entry.entryName && /form[\s-]*16/i.test(entry.entryName)) {
          docType = 'form16';
        }

        // Detect if it's Part A or Part B from PDF CONTENT (not filename)
        let docType_final = docType;
        if (extractedData.form_part === 'partA') {
          docType_final = 'form16_partA';
        } else if (extractedData.form_part === 'partB') {
          docType_final = 'form16_partB';
        } else {
          docType_final = 'form16';
        }
        docType = docType_final;

        // Check if we should skip this file due to missing year
        if (extractedData.skip) {
          const logId = new ObjectId();
          await db.createImportJobLog({
            _id: logId,
            import_job_id: jobId.toString(),
            file_name: entry.entryName,
            status: 'skipped',
            error_message: extractedData.skipReason,
            extracted_data: extractedData,
            created_at: new Date(),
          });
          skippedFiles++;
          processedFiles++;
          console.log(`[Import ${jobId}] Skipped: ${entry.entryName} - ${extractedData.skipReason}`);
          continue;
        }

        // If parser didn't find PAN or name, try to infer from filename
        let filenamePan = null;
        if (entry.entryName) {
          const base = path.basename(entry.entryName, path.extname(entry.entryName));
          const fileParts = base.split(/[_\-\s]+/);
          for (const part of fileParts) {
            const maybePan = part.replace(/[^A-Za-z0-9]/g, '');
            if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(maybePan)) {
              filenamePan = maybePan.toUpperCase();
              extractedData.pan = filenamePan;
              break;
            }
          }
        }
        
        // Extract name from filename as fallback (if not found in PDF)
        if (!extractedData.employee_name && entry.entryName) {
          const base = path.basename(entry.entryName, path.extname(entry.entryName));
          const fileParts = base.split(/[_\-\s]+/);
          for (const part of fileParts) {
            if (/^\d{4}[-\/]?\d{2,4}$/.test(part) || /^\d+$/.test(part)) {
              continue;
            }
            if (/^[A-Za-z\.\'\-]{3,}$/.test(part)) {
              extractedData.employee_name = part.replace(/\./g, ' ');
              break;
            }
          }
        }

        // For government software: PAN is REQUIRED
        if (!extractedData.pan) {
          const logId = new ObjectId();
          await db.createImportJobLog({
            _id: logId,
            import_job_id: jobId.toString(),
            file_name: entry.entryName,
            status: 'failed',
            error_message: 'Missing PAN - cannot identify employee',
            extracted_data: extractedData,
            created_at: new Date(),
          });
          failedFiles++;
          processedFiles++;
          continue;
        }
        
        // If name is missing, use PAN as fallback
        if (!extractedData.employee_name) {
          extractedData.employee_name = extractedData.pan;
        }

        // Check for existing employee
        let employee = await db.getEmployee(extractedData.pan);

        if (!employee) {
          // AUTO-CREATE employee
          const employeeId = new ObjectId();
          const empName = (extractedData.employee_name && extractedData.employee_name.trim()) || extractedData.pan || 'Unknown';
          const empNormalized = empName.toLowerCase().trim();
          const empEmployer = extractedData.employer_name || null;
          await db.createEmployee({
            _id: employeeId,
            pan: extractedData.pan,
            name: empName,
            name_normalized: empNormalized,
            employer_name: empEmployer,
            created_at: new Date(),
          });
          employee = { _id: employeeId };
        }

        const safeYear = extractedData.financial_year || 'unknown';
        
        console.log(`[Import ${jobId}] File: ${entry.entryName} | PAN: ${extractedData.pan} | Year: ${safeYear} | Type: ${docType}`);

        // Save PDF file with original filename
        const docDir = path.join(process.cwd(), 'uploads', 'documents', extractedData.pan, safeYear, docType);
        await fs.mkdir(docDir, { recursive: true });
        
        const fileName = path.basename(entry.entryName || `${Date.now()}.pdf`);
        const docPath = path.join(docDir, fileName);
        await fs.writeFile(docPath, pdfBuffer);

        // Store relative path for portability
        const relativePath = path.join('uploads', 'documents', extractedData.pan, safeYear, docType, fileName);

        // Create document record
        const empName = (extractedData.employee_name && extractedData.employee_name.trim()) || extractedData.pan || 'Unknown';
        const empNormalized = empName.toLowerCase().trim();

        // CHECK FOR DUPLICATES: Don't import same document twice
        const existingDoc = await db.checkDuplicateDocument(employee._id.toString(), docType, safeYear);

        if (existingDoc) {
          console.log(`[Import ${jobId}] ⚠️  DUPLICATE: ${entry.entryName} already exists for ${empName} (${docType} ${safeYear}). Skipping.`);
          const logId = new ObjectId();
          await db.createImportJobLog({
            _id: logId,
            import_job_id: jobId.toString(),
            file_name: entry.entryName,
            status: 'skipped',
            error_message: 'Duplicate document already in system',
            created_at: new Date(),
          });
          skippedFiles++;
          processedFiles++;
          continue;
        }

        const documentId = new ObjectId();
        await db.createDocument({
          _id: documentId,
          employee_id: employee._id.toString(),
          document_type: docType,
          financial_year: safeYear,
          file_path: relativePath,
          file_name: fileName,
          file_size: pdfBuffer.length,
          uploaded_by: uploadedBy,
          review_status: 'approved',
          created_at: new Date(),
          uploaded_at: new Date(),
        });

        // Store metadata
        const metadataId = new ObjectId();
        await db.createDocumentMetadata({
          _id: metadataId,
          document_id: documentId.toString(),
          raw_text: pdfData.text,
          parsed_json: extractedData,
          confidence_score: 0.85,
          created_at: new Date(),
        });

        // Generate AI analysis
        try {
          const analysis = await generateAIAnalysis(extractedData);
          if (analysis) {
            const analysisId = new ObjectId();
            await db.createAIAnalysis({
              _id: analysisId,
              document_id: documentId.toString(),
              salary_summary: analysis.salary_summary,
              tax_summary: analysis.tax_summary,
              investment_summary: analysis.investment_summary,
              observations: analysis.observations,
              employee_explanation: analysis.employee_explanation,
              created_at: new Date(),
            });
          }
        } catch (aiError) {
          console.error('AI analysis error:', aiError);
        }

        // Log success
        const logId = new ObjectId();
        await db.createImportJobLog({
          _id: logId,
          import_job_id: jobId.toString(),
          file_name: entry.entryName,
          status: 'completed',
          employee_id: employee._id.toString(),
          document_id: documentId.toString(),
          extracted_data: extractedData,
          created_at: new Date(),
        });

        successfulFiles++;
        processedFiles++;

      } catch (fileError) {
        console.error('File processing error:', fileError);
        const logId = new ObjectId();
        await db.createImportJobLog({
          _id: logId,
          import_job_id: jobId.toString(),
          file_name: entry.entryName,
          status: 'failed',
          error_message: fileError.message,
          created_at: new Date(),
        });
        failedFiles++;
        processedFiles++;
      }

      // Update progress (batch update every 50 files)
      if (processedFiles % 50 === 0 || processedFiles === pdfFiles.length) {
        await db.updateImportJob(jobId, {
          processed_files: processedFiles,
          successful_files: successfulFiles,
          failed_files: failedFiles,
        });
      }
    }

    // Final update with complete counts
    await db.updateImportJob(jobId, {
      processed_files: processedFiles,
      successful_files: successfulFiles,
      failed_files: failedFiles,
      status: 'completed',
      completed_at: new Date(),
    });

  } catch (error) {
    console.error('Import job error:', error);
    const errorMessage = error.message || String(error);
    
    try {
      await db.updateImportJob(jobId, {
        status: 'failed',
        completed_at: new Date(),
        error_message: errorMessage,
      });
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }
  }
}

// Background processing function for SELECTIVE import
async function processSelectiveImportJob(jobId, filePath, documentType, isZip = true, selectedPANs = []) {
  try {
    // Wait a bit to ensure file is fully written to disk
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify file exists
    try {
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        throw new Error('File was saved but is empty');
      }
      console.log(`[Selective Import ${jobId}] Processing file: ${filePath} (${stats.size} bytes)`);
      console.log(`[Selective Import ${jobId}] Selected PANs: ${selectedPANs.join(', ')}`);
    } catch (statError) {
      throw new Error(`File not accessible after upload: ${statError.message}`);
    }

    // Update status to processing
    await db.updateImportJob(jobId, {
      status: 'processing',
      started_at: new Date(),
    });

    const importJob = await db.getImportJob(jobId);
    const uploadedBy = importJob?.uploaded_by || null;

    let pdfFiles = [];

    if (isZip) {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size === 0) {
          throw new Error('ZIP file is empty');
        }

        console.log(`[Selective Import ${jobId}] Reading ZIP file (${stats.size} bytes)...`);

        // Validate ZIP header
        const headerBuffer = Buffer.alloc(4);
        const fd = await fs.open(filePath, 'r');
        await fd.read(headerBuffer, 0, 4, 0);
        await fd.close();

        if (headerBuffer[0] !== 0x50 || headerBuffer[1] !== 0x4B) {
          throw new Error('Invalid ZIP file format. File does not start with ZIP signature (PK).');
        }

        console.log(`[Selective Import ${jobId}] ZIP header valid, extracting entries using streaming...`);

        pdfFiles = await extractPDFsFromZip(filePath, jobId);

        if (pdfFiles.length === 0) {
          throw new Error('No PDF files found in ZIP archive');
        }

        console.log(`[Selective Import ${jobId}] PDF files found: ${pdfFiles.length}`);
      } catch (zipError) {
        console.error(`[Selective Import ${jobId}] ZIP processing error:`, zipError.message);
        throw zipError;
      }
    } else {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size === 0) {
          throw new Error('PDF file is empty');
        }

        const data = await fs.readFile(filePath);

        // Validate PDF header
        if (data[0] !== 0x25 || data[1] !== 0x50 || data[2] !== 0x44 || data[3] !== 0x46) { // %PDF
          throw new Error('Invalid PDF file format. File does not start with PDF signature.');
        }

        pdfFiles = [{ entryName: path.basename(filePath), getData: () => data }];
      } catch (pdfError) {
        console.error('PDF file validation error:', pdfError.message);
        throw pdfError;
      }
    }

    const totalFiles = pdfFiles.length;
    let processedFiles = 0;
    let successfulFiles = 0;
    let failedFiles = 0;
    let skippedFiles = 0;

    // Update total files
    await db.updateImportJob(jobId, { total_files: totalFiles });

    // Convert selectedPANs to Set for faster lookup
    const selectedPANsSet = new Set(selectedPANs.map(p => p.toUpperCase()));

    // Process each PDF - ONLY if PAN is in selectedPANs
    for (const entry of pdfFiles) {
      try {
        console.log(`[Selective Import ${jobId}] DEBUG RAW ENTRY: ${JSON.stringify({entryName: entry.entryName, hasSlash: entry.entryName.includes('/')})}`);
        
        // Skip macOS metadata files
        if (entry.entryName.includes('__MACOSX') || entry.entryName.startsWith('._')) {
          continue;
        }

        const pdfBuffer = entry.getData();

        // Validate PDF buffer
        if (!pdfBuffer || pdfBuffer.length === 0) {
          throw new Error('Empty PDF file');
        }

        // Parse PDF
        let pdfData;
        try {
          pdfData = await pdf(pdfBuffer, {
            max: 0,
            version: 'v1.10.100'
          });
        } catch (pdfError) {
          console.error(`PDF parse error for ${entry.entryName}:`, pdfError);
          throw new Error(`Invalid PDF format: ${pdfError.message}`);
        }

        const extractedData = processForm16(pdfData.text);
        // Prefer content-based form part detection
        try {
          const detectedPart = detectFormPartFromText(pdfData.text);
          if (detectedPart) extractedData.form_part = detectedPart;
        } catch (e) {
          // ignore
        }

        console.log(`[Selective Import ${jobId}] Extracting year from PDF content for: ${entry.entryName}`);
        
        // Check if financial_year was extracted from PDF content
        if (!extractedData.financial_year && extractedData.assessment_year) {
          extractedData.financial_year = extractedData.assessment_year;
          console.log(`[Selective Import ${jobId}] Using assessment_year from PDF: ${extractedData.assessment_year}`);
        }
        
        // If still no year found → skip this file
        if (!extractedData.financial_year) {
          console.log(`[Selective Import ${jobId}] WARNING: No financial year found in PDF! Will skip this file.`);
          extractedData.skip = true;
          extractedData.skipReason = 'No financial year found in PDF content';
        } else {
          console.log(`[Selective Import ${jobId}] Using financial year from PDF: ${extractedData.financial_year}`);
        }

        // Try to extract PAN from filename if not found
        if (!extractedData.pan && entry.entryName) {
          const base = path.basename(entry.entryName, path.extname(entry.entryName));
          const fileParts = base.split(/[_\-\s]+/);
          for (const part of fileParts) {
            const maybePan = part.replace(/[^A-Za-z0-9]/g, '');
            if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(maybePan)) {
              extractedData.pan = maybePan.toUpperCase();
              break;
            }
          }
        }

        // CHECK: Is this PAN in the selected list?
        const panUppercase = (extractedData.pan || '').toUpperCase();
        if (!selectedPANsSet.has(panUppercase)) {
          console.log(`[Selective Import ${jobId}] Skipping ${entry.entryName} (PAN ${panUppercase} not selected)`);
          skippedFiles++;
          processedFiles++;
          continue;
        }

        // Rest of processing is same as regular import
        let docType = documentType;
        if (!docType) {
          docType = extractedData.is_form16 ? 'form16' : 'unknown';
        }

        if (entry.entryName && /form[\s-]*16/i.test(entry.entryName)) {
          docType = 'form16';
        }

        // Detect if it's Part A or Part B from PDF CONTENT
        let docType_final = docType;
        if (extractedData.form_part === 'partA') {
          docType_final = 'form16_partA';
        } else if (extractedData.form_part === 'partB') {
          docType_final = 'form16_partB';
        } else {
          docType_final = 'form16';
        }
        docType = docType_final;

        // Check if we should skip this file due to missing year
        if (extractedData.skip) {
          console.log(`[Selective Import ${jobId}] Skipped: ${entry.entryName} - ${extractedData.skipReason}`);
          skippedFiles++;
          processedFiles++;
          continue;
        }

        // Extract PAN from filename if not found in PDF
        if (!extractedData.pan && entry.entryName) {
          const base = path.basename(entry.entryName, path.extname(entry.entryName));
          const fileParts = base.split(/[_\-\s]+/);
          for (const part of fileParts) {
            const maybePan = part.replace(/[^A-Za-z0-9]/g, '');
            if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(maybePan)) {
              extractedData.pan = maybePan.toUpperCase();
              break;
            }
          }
        }

        // Extract name from filename if not found in PDF
        if (!extractedData.employee_name && entry.entryName) {
          const base = path.basename(entry.entryName, path.extname(entry.entryName));
          const fileParts = base.split(/[_\-\s]+/);
          for (const part of fileParts) {
            if (/^\d{4}[-\/]?\d{2,4}$/.test(part) || /^\d+$/.test(part)) {
              continue;
            }
            if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(part)) {
              continue;
            }
            if (/^[A-Za-z\.\'\-]{3,}$/.test(part)) {
              extractedData.employee_name = part.replace(/\./g, ' ');
              break;
            }
          }
        }

        // If missing PAN or name for form16, mark as failed
        if (docType.includes('form16') && (!extractedData.pan || !extractedData.employee_name)) {
          const logId = new ObjectId();
          await db.createImportJobLog({
            _id: logId,
            import_job_id: jobId.toString(),
            file_name: entry.entryName,
            status: 'failed',
            error_message: 'Missing PAN or Employee Name',
            extracted_data: extractedData,
            created_at: new Date(),
          });
          failedFiles++;
          processedFiles++;
          continue;
        }

        // Check for existing employee
        let employee = await db.getEmployee(extractedData.pan);

        if (!employee && docType === 'form16') {
          const employeeId = new ObjectId();
          const empName = (extractedData.employee_name && extractedData.employee_name.trim()) || extractedData.pan || 'Unknown';
          const empNormalized = empName.toLowerCase().trim();
          const empEmployer = extractedData.employer_name || null;
          await db.createEmployee({
            _id: employeeId,
            pan: extractedData.pan,
            name: empName,
            name_normalized: empNormalized,
            employer_name: empEmployer,
            created_at: new Date(),
          });
          employee = { _id: employeeId };
        } else if (!employee) {
          const logId = new ObjectId();
          await db.createImportJobLog({
            _id: logId,
            import_job_id: jobId.toString(),
            file_name: entry.entryName,
            status: 'failed',
            error_message: 'Employee not found',
            extracted_data: extractedData,
            created_at: new Date(),
          });
          failedFiles++;
          processedFiles++;
          continue;
        }

        // Check for duplicate
        const safeYear = extractedData.financial_year || 'unknown';
        const docDir = path.join(process.cwd(), 'uploads', 'documents', extractedData.pan, safeYear, docType);
        await fs.mkdir(docDir, { recursive: true });

        const fileName = path.basename(entry.entryName || `${Date.now()}.pdf`);
        const docPath = path.join(docDir, fileName);
        await fs.writeFile(docPath, pdfBuffer);

        const relativePath = path.join('uploads', 'documents', extractedData.pan, safeYear, docType, fileName);

        // Create document record
        const empName = (extractedData.employee_name && extractedData.employee_name.trim()) || extractedData.pan || 'Unknown';
        const empNormalized = empName.toLowerCase().trim();

        // CHECK FOR DUPLICATES: Don't import same document twice
        const existingDoc = await db.checkDuplicateDocument(employee._id.toString(), docType, safeYear);

        if (existingDoc) {
          console.log(`[Import ${jobId}] ⚠️  DUPLICATE (Selective): ${entry.entryName} already exists for ${empName} (${docType} ${safeYear}). Skipping.`);
          const logId = new ObjectId();
          await db.createImportJobLog({
            _id: logId,
            import_job_id: jobId.toString(),
            file_name: entry.entryName,
            status: 'skipped',
            error_message: 'Duplicate document already in system',
            created_at: new Date(),
          });
          continue;
        }

        const documentId = new ObjectId();
        await db.createDocument({
          _id: documentId,
          employee_id: employee._id.toString(),
          document_type: docType,
          financial_year: safeYear,
          file_path: relativePath,
          file_name: fileName,
          file_size: pdfBuffer.length,
          uploaded_by: uploadedBy,
          review_status: 'approved',
          created_at: new Date(),
          uploaded_at: new Date(),
        });

        // Store metadata
        const metadataId = new ObjectId();
        await db.createDocumentMetadata({
          _id: metadataId,
          document_id: documentId.toString(),
          raw_text: pdfData.text,
          parsed_json: extractedData,
          confidence_score: 0.85,
          created_at: new Date(),
        });

        // Generate AI analysis
        try {
          const analysis = await generateAIAnalysis(extractedData);
          if (analysis) {
            const analysisId = new ObjectId();
            await db.createAIAnalysis({
              _id: analysisId,
              document_id: documentId.toString(),
              salary_summary: analysis.salary_summary,
              tax_summary: analysis.tax_summary,
              investment_summary: analysis.investment_summary,
              observations: analysis.observations,
              employee_explanation: analysis.employee_explanation,
              created_at: new Date(),
            });
          }
        } catch (aiError) {
          console.error('AI analysis error:', aiError);
        }

        // Log success
        const logId = new ObjectId();
        await db.createImportJobLog({
          _id: logId,
          import_job_id: jobId.toString(),
          file_name: entry.entryName,
          status: 'completed',
          employee_id: employee._id.toString(),
          document_id: documentId.toString(),
          extracted_data: extractedData,
          created_at: new Date(),
        });

        successfulFiles++;
        processedFiles++;

      } catch (fileError) {
        console.error('File processing error:', fileError);
        const logId = new ObjectId();
        await db.createImportJobLog({
          _id: logId,
          import_job_id: jobId.toString(),
          file_name: entry.entryName,
          status: 'failed',
          error_message: fileError.message,
          created_at: new Date(),
        });
        failedFiles++;
        processedFiles++;
      }

      // Update progress (batch update every 50 files)
      if (processedFiles % 50 === 0 || processedFiles === pdfFiles.length) {
        await db.updateImportJob(jobId, {
          processed_files: processedFiles,
          successful_files: successfulFiles,
          failed_files: failedFiles,
        });
      }
    }

    console.log(`[Selective Import ${jobId}] Completed - Success: ${successfulFiles}, Failed: ${failedFiles}, Skipped: ${skippedFiles}`);

    // Final update with complete counts
    await db.updateImportJob(jobId, {
      processed_files: processedFiles,
      successful_files: successfulFiles,
      failed_files: failedFiles,
      status: 'completed',
      completed_at: new Date(),
    });

  } catch (error) {
    console.error('Selective import job error:', error);
    const errorMessage = error.message || String(error);

    try {
      await db.updateImportJob(jobId, {
        status: 'failed',
        completed_at: new Date(),
        error_message: errorMessage,
      });
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }
  }
}

export default router;
