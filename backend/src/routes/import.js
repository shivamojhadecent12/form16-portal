import express from 'express';
import fileUpload from 'express-fileupload';
import yauzl from 'yauzl';
import pdf from 'pdf-parse';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { processForm16 } from '../services/pdfProcessor.js';
import { generateAIAnalysis } from '../services/aiService.js';
import { generateUUID } from '../utils/uuid.js';

const router = express.Router();

// Get all import jobs
router.get('/jobs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [jobs] = await pool.query(
      'SELECT * FROM import_jobs ORDER BY created_at DESC'
    );
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
    const [jobs] = await pool.query('SELECT * FROM import_jobs WHERE id = ?', [id]);
    
    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    res.json(jobs[0]);
  } catch (error) {
    console.error('Get import job error:', error);
    res.status(500).json({ error: 'Failed to fetch import job' });
  }
});

// Get import job logs
router.get('/jobs/:id/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [logs] = await pool.query(
      'SELECT * FROM import_job_logs WHERE import_job_id = ? ORDER BY created_at DESC',
      [id]
    );
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
          // Check if ZIP has proper end of central directory record (last 22+ bytes)
          const fd = await fs.open(savedPath, 'r');
          const bufferSize = Math.min(65535 + 22, stats.size); // ZIP end record is within last 65KB
          const lastBuffer = Buffer.alloc(bufferSize);
          await fd.read(lastBuffer, 0, bufferSize, Math.max(0, stats.size - bufferSize));
          await fd.close();

          // Look for ZIP end of central directory signature (0x06054b50)
          const endSignatureIndex = lastBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
          if (endSignatureIndex === -1) {
            throw new Error('ZIP file appears truncated - missing end of central directory record. Please re-upload.');
          }
        }
      } catch (verifyError) {
        // Delete the incomplete file
        try {
          await fs.unlink(savedPath);
        } catch (deleteErr) {
          console.error('Failed to delete incomplete file:', deleteErr.message);
        }
        return res.status(400).json({ error: verifyError.message || 'Failed to verify uploaded file' });
      }

      // Create import job (status pending)
      const jobId = generateUUID();
      await pool.query(
        `INSERT INTO import_jobs (id, document_type, file_name, file_path, uploaded_by, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [jobId, documentType || null, file.name, savedPath, req.user.id]
      );

      // Decide processing mode: zip or single pdf
      // Decide processing mode: zip or single pdf
      const isZip = file.name.toLowerCase().endsWith('.zip');

      // If documentType not provided, we'll attempt to auto-detect per-file during processing
      processImportJob(jobId, savedPath, documentType, isZip).catch(err => {
        console.error('Background processing error:', err);
      });

      res.json({ 
        message: 'Upload successful, processing started', 
        jobId,
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
            // Override form_part using content-based detection when possible
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
      const jobId = generateUUID();
      const selectedPANsJSON = JSON.stringify(selectedPANs);
      await pool.query(
        `INSERT INTO import_jobs (id, document_type, file_name, file_path, uploaded_by, status, filter_pans)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [jobId, documentType || null, file.name, savedPath, req.user.id, selectedPANsJSON]
      );

      // Start selective processing
      const isZip = file.name.toLowerCase().endsWith('.zip');
      processSelectiveImportJob(jobId, savedPath, documentType, isZip, selectedPANs).catch(err => {
        console.error('Selective import background processing error:', err);
      });

      res.json({
        message: 'Selective import started',
        jobId,
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
        
        // Provide helpful error messages for common ZIP issues
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
    // These phrases often appear in Part B which contains salary/tax details
    return 'partB';
  }

  // No decisive match
  return null;
}

// Background processing function
async function processImportJob(jobId, filePath, documentType, isZip = true) {
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
    await pool.query(
      'UPDATE import_jobs SET status = ?, started_at = NOW() WHERE id = ?',
      ['processing', jobId]
    );
  // Load job to get uploader (we don't have access to req in background worker)
  const [jobRows] = await pool.query('SELECT * FROM import_jobs WHERE id = ?', [jobId]);
  const jobRow = jobRows && jobRows[0] ? jobRows[0] : null;
  const uploadedBy = jobRow ? jobRow.uploaded_by : null;
    let pdfFiles = [];

    if (isZip) {
      // Extract ZIP with streaming (handles large files)
      try {
        // First check if file exists and has content
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

        // Use yauzl for streaming ZIP extraction
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
      // Single PDF file
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

    // Update total files
    await pool.query(
      'UPDATE import_jobs SET total_files = ? WHERE id = ?',
      [totalFiles, jobId]
    );

  // Process each PDF
  for (const entry of pdfFiles) {
      try {
        console.log(`[Import ${jobId}] DEBUG RAW ENTRY: ${JSON.stringify({entryName: entry.entryName, hasSlash: entry.entryName.includes('/')})}`);
        
        // Skip macOS metadata files
        if (entry.entryName.includes('__MACOSX') || entry.entryName.startsWith('._')) {
          continue;
        }

  // entry.getData() for zip entries returns Buffer; for single-file array we provided same shape
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

        // EXTRACT FINANCIAL YEAR FROM PDF CONTENT ONLY
        // Do not use filename or folder information
        // If year cannot be found in PDF → skip the file
        
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
        // The PDF processor extracts form_part field
        let docType_final = docType; // Use the detected docType
        if (extractedData.form_part === 'partA') {
          docType_final = 'form16_partA';
        } else if (extractedData.form_part === 'partB') {
          docType_final = 'form16_partB';
        } else {
          // Fallback: if form_part couldn't be determined from PDF, default to form16
          docType_final = 'form16';
        }
        docType = docType_final;

        // Check if we should skip this file due to missing year
        if (extractedData.skip) {
          const logId = generateUUID();
          await pool.query(
            `INSERT INTO import_job_logs (id, import_job_id, file_name, status, error_message, extracted_data)
             VALUES (?, ?, ?, 'skipped', ?, ?)`,
            [logId, jobId, entry.entryName, extractedData.skipReason, JSON.stringify(extractedData)]
          );
          skippedFiles++;
          processedFiles++;
          console.log(`[Import ${jobId}] Skipped: ${entry.entryName} - ${extractedData.skipReason}`);
          continue;
        }

        // If parser didn't find PAN or name, try to infer from filename (common patterns)
        // IMPORTANT: Filename PAN often contains the EMPLOYEE's PAN (from filename), while extracted PAN
        // might be the deductor/employer PAN. Filename takes precedence for duplicate detection.
        let filenamePan = null;
        if (entry.entryName) {
          const base = path.basename(entry.entryName, path.extname(entry.entryName));
          const fileParts = base.split(/[_\-\s]+/);
          for (const part of fileParts) {
            const maybePan = part.replace(/[^A-Za-z0-9]/g, '');
            if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(maybePan)) {
              filenamePan = maybePan.toUpperCase();
              // Filename PAN takes priority (more likely to be employee PAN)
              extractedData.pan = filenamePan;
              break; // Stop after finding first valid PAN in filename
            }
          }
        }
        
        // Extract name from filename as fallback (if not found in PDF)
        if (!extractedData.employee_name && entry.entryName) {
          const base = path.basename(entry.entryName, path.extname(entry.entryName));
          const fileParts = base.split(/[_\-\s]+/);
          for (const part of fileParts) {
            // Skip numeric parts and year patterns
            if (/^\d{4}[-\/]?\d{2,4}$/.test(part) || /^\d+$/.test(part)) {
              continue;
            }
            // Accept name-like tokens
            if (/^[A-Za-z\.\'\-]{3,}$/.test(part)) {
              extractedData.employee_name = part.replace(/\./g, ' ');
              break; // Take first name-like token
            }
          }
        }

        // For government software: PAN is REQUIRED, but Name can default to PAN if missing
        // This ensures we can still import files with extraction issues
        if (!extractedData.pan) {
          const logId = generateUUID();
          await pool.query(
            `INSERT INTO import_job_logs (id, import_job_id, file_name, status, error_message, extracted_data)
             VALUES (?, ?, ?, 'failed', ?, ?)`,
            [logId, jobId, entry.entryName, 'Missing PAN - cannot identify employee', JSON.stringify(extractedData)]
          );
          failedFiles++;
          processedFiles++;
          continue;
        }
        
        // If name is missing, use PAN as fallback (better than failing)
        if (!extractedData.employee_name) {
          extractedData.employee_name = extractedData.pan;
        }

        // Check for existing employee
        let [employees] = await pool.query(
          'SELECT * FROM employees WHERE pan = ?',
          [extractedData.pan]
        );

        let employee;
        if (employees.length === 0) {
          // AUTO-CREATE employee with safe name fallback (use PAN if name missing)
          // This ensures 100% import success for government use
          const employeeId = generateUUID();
          const empName = (extractedData.employee_name && extractedData.employee_name.trim()) || extractedData.pan || 'Unknown';
          const empNormalized = empName.toLowerCase().trim();
          const empEmployer = extractedData.employer_name || null;
          await pool.query(
            `INSERT INTO employees (id, pan, name, name_normalized, employer_name)
             VALUES (?, ?, ?, ?, ?)`,
            [
              employeeId,
              extractedData.pan,
              empName,
              empNormalized,
              empEmployer
            ]
          );
          employee = { id: employeeId };
        } else {
          employee = employees[0];
        }

        // Check for duplicate (use resolved docType and safe financial year)
        const safeYear = extractedData.financial_year || 'unknown';
        // Note: We allow multiple documents with same (employee, type, year)
        // This enables storing multiple versions/versions of the same document
        // Users can re-upload corrected or updated PDFs, and both will be kept
        
        console.log(`[Import ${jobId}] File: ${entry.entryName} | PAN: ${extractedData.pan} | Year: ${safeYear} | Type: ${docType}`);

        // Save PDF file with original filename (no renaming needed)
  const docDir = path.join(process.cwd(), 'uploads', 'documents', extractedData.pan, safeYear, docType);
        await fs.mkdir(docDir, { recursive: true });
        
        // Keep original filename from ZIP (remove any directory path)
  const fileName = path.basename(entry.entryName || `${Date.now()}.pdf`);
  const docPath = path.join(docDir, fileName);
        await fs.writeFile(docPath, pdfBuffer);

        // Store relative path for portability
  const relativePath = path.join('uploads', 'documents', extractedData.pan, safeYear, docType, fileName);

        // Create document record
        // Ensure employee has a name
        const empName = (extractedData.employee_name && extractedData.employee_name.trim()) || extractedData.pan || 'Unknown';
        const empNormalized = empName.toLowerCase().trim();

        // CHECK FOR DUPLICATES: Don't import same document twice
        // A duplicate is: same employee_id + document_type + financial_year
        const [existingDocs] = await pool.query(
          `SELECT id FROM documents 
           WHERE employee_id = ? AND document_type = ? AND financial_year = ?
           LIMIT 1`,
          [employee.id, docType, safeYear]
        );

        if (existingDocs && existingDocs.length > 0) {
          console.log(`[Import ${jobId}] ⚠️  DUPLICATE: ${entry.entryName} already exists for ${employee.name} (${docType} ${safeYear}). Skipping.`);
          const logId = generateUUID();
          await pool.query(
            `INSERT INTO import_job_logs (id, import_job_id, file_name, status, error_message)
             VALUES (?, ?, ?, 'skipped', ?)`,
            [logId, jobId, entry.entryName, 'Duplicate document already in system']
          );
          skippedFiles++;
          processedFiles++;
          continue;
        }

        const documentId = generateUUID();
        await pool.query(
          `INSERT INTO documents (id, employee_id, document_type, financial_year, file_path, file_name, file_size, uploaded_by, review_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
          [documentId, employee.id, docType, safeYear, relativePath, fileName, pdfBuffer.length, uploadedBy]
        );

        // Store metadata
        const metadataId = generateUUID();
        await pool.query(
          `INSERT INTO document_metadata (id, document_id, raw_text, parsed_json, confidence_score)
           VALUES (?, ?, ?, ?, ?)`,
          [metadataId, documentId, pdfData.text, JSON.stringify(extractedData), 0.85]
        );

        // Generate AI analysis
        try {
          const analysis = await generateAIAnalysis(extractedData);
          if (analysis) {
            const analysisId = generateUUID();
            await pool.query(
              `INSERT INTO ai_analysis (id, document_id, salary_summary, tax_summary, investment_summary, observations, employee_explanation)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                analysisId,
                documentId,
                JSON.stringify(analysis.salary_summary),
                JSON.stringify(analysis.tax_summary),
                JSON.stringify(analysis.investment_summary),
                JSON.stringify(analysis.observations),
                analysis.employee_explanation
              ]
            );
          }
        } catch (aiError) {
          console.error('AI analysis error:', aiError);
        }

        // Log success
        const logId = generateUUID();
        await pool.query(
          `INSERT INTO import_job_logs (id, import_job_id, file_name, status, employee_id, document_id, extracted_data)
           VALUES (?, ?, ?, 'completed', ?, ?, ?)`,
          [logId, jobId, entry.entryName, employee.id, documentId, JSON.stringify(extractedData)]
        );

        successfulFiles++;
        processedFiles++;

      } catch (fileError) {
        console.error('File processing error:', fileError);
        const logId = generateUUID();
        await pool.query(
          `INSERT INTO import_job_logs (id, import_job_id, file_name, status, error_message)
           VALUES (?, ?, ?, 'failed', ?)`,
          [logId, jobId, entry.entryName, fileError.message]
        );
        failedFiles++;
        processedFiles++;
      }

      // Update progress (batch update every 50 files instead of every file)
      if (processedFiles % 50 === 0 || processedFiles === pdfFiles.length) {
        await pool.query(
          'UPDATE import_jobs SET processed_files = ?, successful_files = ?, failed_files = ? WHERE id = ?',
          [processedFiles, successfulFiles, failedFiles, jobId]
        );
      }
    }

    // Final update with complete counts
    await pool.query(
      'UPDATE import_jobs SET processed_files = ?, successful_files = ?, failed_files = ? WHERE id = ?',
      [processedFiles, successfulFiles, failedFiles, jobId]
    );

    // Mark job as completed
    await pool.query(
      'UPDATE import_jobs SET status = ?, completed_at = NOW() WHERE id = ?',
      ['completed', jobId]
    );

  } catch (error) {
    console.error('Import job error:', error);
    const errorMessage = error.message || String(error);
    
    try {
      // Update job status to failed with error message
      await pool.query(
        'UPDATE import_jobs SET status = ?, completed_at = NOW(), error_message = ? WHERE id = ?',
        ['failed', errorMessage, jobId]
      );
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }
  }
}

// Background processing function for SELECTIVE import (only specific employees)
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
    await pool.query(
      'UPDATE import_jobs SET status = ?, started_at = NOW() WHERE id = ?',
      ['processing', jobId]
    );

    const [jobRows] = await pool.query('SELECT * FROM import_jobs WHERE id = ?', [jobId]);
    const jobRow = jobRows && jobRows[0] ? jobRows[0] : null;
    const uploadedBy = jobRow ? jobRow.uploaded_by : null;

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

        // Use yauzl for streaming ZIP extraction
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
    await pool.query(
      'UPDATE import_jobs SET total_files = ? WHERE id = ?',
      [totalFiles, jobId]
    );

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
        // Prefer content-based form part detection over filename heuristics
        try {
          const detectedPart = detectFormPartFromText(pdfData.text);
          if (detectedPart) extractedData.form_part = detectedPart;
        } catch (e) {
          // ignore
        }

        // PRIORITY EXTRACTION FOR FINANCIAL YEAR:
        // 1. ZIP folder path (highest priority) - e.g., "25-26" from "71 BN SSB FORM-16...25-26/"
        // 2. Filename (second priority) - e.g., "2025-26" from "AAPPF9976K_2025-26.pdf"
        // 3. PDF content (third priority) - from processForm16() call above
        // 4. Assessment year fallback (lowest priority)
        
        let folderYear = null;
        let filenameYear = null;
        
        // Try to extract from ZIP folder path (HIGHEST PRIORITY)
        if (entry.entryName && entry.entryName.includes('/')) {
          const folderPath = entry.entryName.substring(0, entry.entryName.lastIndexOf('/'));
          console.log(`[Selective Import ${jobId}] DEBUG: Full entry path: ${entry.entryName}`);
          console.log(`[Selective Import ${jobId}] DEBUG: Folder path: ${folderPath}`);
          const folderParts = folderPath.split(/[_\-\s]+/);
          console.log(`[Selective Import ${jobId}] DEBUG: Folder parts: ${JSON.stringify(folderParts)}`);
          for (const part of folderParts) {
            console.log(`[Selective Import ${jobId}] DEBUG: Testing part: "${part}" against /^\d{2,4}[-\/]?\d{2,4}$/`);
            // Match year patterns: 25-26 (2-digit) or 2025-26 (4-digit)
            if (/^\d{2,4}[-\/]?\d{2,4}$/.test(part)) {
              let normalized = part;
              // Normalize 2-digit years: 25-26 → 2025-26
              if (part.match(/^\d{2}[-\/]\d{2,4}$/)) {
                const [first, second] = part.split(/[-\/]/);
                normalized = `20${first}-${second}`;
              }
              folderYear = normalized;
              console.log(`[Selective Import ${jobId}] Found year in ZIP folder: ${normalized} (from ${part})`);
              break;
            }
          }
        }
        
        // EXTRACT FINANCIAL YEAR FROM PDF CONTENT ONLY
        // Do not use filename or folder information
        // If year cannot be found in PDF → skip the file
        
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

        // Detect if it's Part A or Part B from PDF CONTENT (not filename)
        // The PDF processor extracts form_part field
        let docType_final = docType; // Use the detected docType
        if (extractedData.form_part === 'partA') {
          docType_final = 'form16_partA';
        } else if (extractedData.form_part === 'partB') {
          docType_final = 'form16_partB';
        } else {
          // Fallback: if form_part couldn't be determined from PDF, default to form16
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
            // Skip numeric parts and year patterns
            if (/^\d{4}[-\/]?\d{2,4}$/.test(part) || /^\d+$/.test(part)) {
              continue;
            }
            // Skip if looks like PAN
            if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(part)) {
              continue;
            }
            // Accept name-like tokens
            if (/^[A-Za-z\.\'\-]{3,}$/.test(part)) {
              extractedData.employee_name = part.replace(/\./g, ' ');
              break;
            }
          }
        }

        // If missing PAN or name for form16, mark as failed
        if (docType.includes('form16') && (!extractedData.pan || !extractedData.employee_name)) {
          const logId = generateUUID();
          await pool.query(
            `INSERT INTO import_job_logs (id, import_job_id, file_name, status, error_message, extracted_data)
             VALUES (?, ?, ?, 'failed', ?, ?)`,
            [logId, jobId, entry.entryName, 'Missing PAN or Employee Name', JSON.stringify(extractedData)]
          );
          failedFiles++;
          processedFiles++;
          continue;
        }

        // Check for existing employee
        let [employees] = await pool.query(
          'SELECT * FROM employees WHERE pan = ?',
          [extractedData.pan]
        );

        let employee;
        if (employees.length === 0 && docType === 'form16') {
          const employeeId = generateUUID();
          const empName = (extractedData.employee_name && extractedData.employee_name.trim()) || extractedData.pan || 'Unknown';
          const empNormalized = empName.toLowerCase().trim();
          const empEmployer = extractedData.employer_name || null;
          await pool.query(
            `INSERT INTO employees (id, pan, name, name_normalized, employer_name)
             VALUES (?, ?, ?, ?, ?)`,
            [employeeId, extractedData.pan, empName, empNormalized, empEmployer]
          );
          employee = { id: employeeId };
        } else if (employees.length > 0) {
          employee = employees[0];
        } else {
          const logId = generateUUID();
          await pool.query(
            `INSERT INTO import_job_logs (id, import_job_id, file_name, status, error_message, extracted_data)
             VALUES (?, ?, ?, 'failed', ?, ?)`,
            [logId, jobId, entry.entryName, 'Employee not found', JSON.stringify(extractedData)]
          );
          failedFiles++;
          processedFiles++;
          continue;
        }

        // Check for duplicate
        const safeYear = extractedData.financial_year || 'unknown';
        // Note: We allow multiple documents with same (employee, type, year)
        // This enables storing multiple versions of the same document type/year
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
        // A duplicate is: same employee_id + document_type + financial_year
        const [existingDocs] = await pool.query(
          `SELECT id FROM documents 
           WHERE employee_id = ? AND document_type = ? AND financial_year = ?
           LIMIT 1`,
          [employee.id, docType, safeYear]
        );

        if (existingDocs && existingDocs.length > 0) {
          console.log(`[Import ${jobId}] ⚠️  DUPLICATE (Selective): ${entry.entryName} already exists for ${employee.name} (${docType} ${safeYear}). Skipping.`);
          const logId = generateUUID();
          await pool.query(
            `INSERT INTO import_job_logs (id, import_job_id, file_name, status, error_message)
             VALUES (?, ?, ?, 'skipped', ?)`,
            [logId, jobId, entry.entryName, 'Duplicate document already in system']
          );
          continue;
        }

        const documentId = generateUUID();
        await pool.query(
          `INSERT INTO documents (id, employee_id, document_type, financial_year, file_path, file_name, file_size, uploaded_by, review_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
          [documentId, employee.id, docType, safeYear, relativePath, fileName, pdfBuffer.length, uploadedBy]
        );

        // Store metadata
        const metadataId = generateUUID();
        await pool.query(
          `INSERT INTO document_metadata (id, document_id, raw_text, parsed_json, confidence_score)
           VALUES (?, ?, ?, ?, ?)`,
          [metadataId, documentId, pdfData.text, JSON.stringify(extractedData), 0.85]
        );

        // Generate AI analysis
        try {
          const analysis = await generateAIAnalysis(extractedData);
          if (analysis) {
            const analysisId = generateUUID();
            await pool.query(
              `INSERT INTO ai_analysis (id, document_id, salary_summary, tax_summary, investment_summary, observations, employee_explanation)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                analysisId,
                documentId,
                JSON.stringify(analysis.salary_summary),
                JSON.stringify(analysis.tax_summary),
                JSON.stringify(analysis.investment_summary),
                JSON.stringify(analysis.observations),
                analysis.employee_explanation
              ]
            );
          }
        } catch (aiError) {
          console.error('AI analysis error:', aiError);
        }

        // Log success
        const logId = generateUUID();
        await pool.query(
          `INSERT INTO import_job_logs (id, import_job_id, file_name, status, employee_id, document_id, extracted_data)
           VALUES (?, ?, ?, 'completed', ?, ?, ?)`,
          [logId, jobId, entry.entryName, employee.id, documentId, JSON.stringify(extractedData)]
        );

        successfulFiles++;
        processedFiles++;

      } catch (fileError) {
        console.error('File processing error:', fileError);
        const logId = generateUUID();
        await pool.query(
          `INSERT INTO import_job_logs (id, import_job_id, file_name, status, error_message)
           VALUES (?, ?, ?, 'failed', ?)`,
          [logId, jobId, entry.entryName, fileError.message]
        );
        failedFiles++;
        processedFiles++;
      }

      // Update progress (batch update every 50 files instead of every file)
      if (processedFiles % 50 === 0 || processedFiles === pdfFiles.length) {
        await pool.query(
          'UPDATE import_jobs SET processed_files = ?, successful_files = ?, failed_files = ? WHERE id = ?',
          [processedFiles, successfulFiles, failedFiles, jobId]
        );
      }
    }

    console.log(`[Selective Import ${jobId}] Completed - Success: ${successfulFiles}, Failed: ${failedFiles}, Skipped: ${skippedFiles}`);

    // Final update with complete counts
    await pool.query(
      'UPDATE import_jobs SET processed_files = ?, successful_files = ?, failed_files = ? WHERE id = ?',
      [processedFiles, successfulFiles, failedFiles, jobId]
    );

    // Mark job as completed
    await pool.query(
      'UPDATE import_jobs SET status = ?, completed_at = NOW() WHERE id = ?',
      ['completed', jobId]
    );

  } catch (error) {
    console.error('Selective import job error:', error);
    const errorMessage = error.message || String(error);

    try {
      await pool.query(
        'UPDATE import_jobs SET status = ?, completed_at = NOW(), error_message = ? WHERE id = ?',
        ['failed', errorMessage, jobId]
      );
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }
  }
}

export default router;
