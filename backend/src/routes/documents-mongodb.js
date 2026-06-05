import express from 'express';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import fileUpload from 'express-fileupload';
import pdf from 'pdf-parse';
import * as db from '../services/db.js';
import { authenticateToken, requireAdmin, checkOwnership } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { generateUUID } from '../utils/uuid.js';
import { processForm16 } from '../services/pdfProcessor.js';
import { generateAIAnalysis } from '../services/aiService.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

// ─── IMPORTANT: specific routes MUST come before /:id ───────────────────────

// Get pending reviews (Admin only) — must be before /:id
router.get('/reviews/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const documents = await db.getAllDocuments(0, 10000, { review_status: 'pending' });
    
    // Enrich with employee data
    const enriched = await Promise.all(documents.map(async (doc) => {
      const employee = await db.getEmployeeById(new ObjectId(doc.employee_id));
      return {
        ...doc,
        employee_name: employee?.name || 'Unknown',
        employee_pan: employee?.pan || 'Unknown',
      };
    }));
    
    res.json(enriched);
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});

// ─── Collection routes ───────────────────────────────────────────────────────

// Get all documents
router.get('/', authenticateToken, checkOwnership, async (req, res) => {
  try {
    let filters = {};

    // If employeeId is provided in query, filter by that
    if (req.query.employeeId) {
      filters.employee_id = req.query.employeeId;
    } else if (req.user.role === 'employee') {
      // If no employeeId but user is employee, filter by their own ID
      filters.employee_id = req.user.id;
    }
    // If admin and no employeeId, return all documents

    const documents = await db.getAllDocuments(0, 10000, filters);
    
    // Enrich with employee data
    const enriched = await Promise.all(documents.map(async (doc) => {
      const employee = await db.getEmployeeById(new ObjectId(doc.employee_id));
      return {
        ...doc,
        employee_name: employee?.name || 'Unknown',
        employee_pan: employee?.pan || 'Unknown',
      };
    }));
    
    // Sort by uploaded_at descending
    enriched.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
    
    res.json(enriched);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// ─── Single document routes ──────────────────────────────────────────────────

// Get single document
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await db.getDocument(new ObjectId(id));
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (req.user.role === 'employee' && document.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Enrich with employee data
    const employee = await db.getEmployeeById(new ObjectId(document.employee_id));
    const enriched = {
      ...document,
      employee_name: employee?.name || 'Unknown',
      employee_pan: employee?.pan || 'Unknown',
    };

    res.json(enriched);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Get document metadata
router.get('/:id/metadata', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const document = await db.getDocument(new ObjectId(id));
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (req.user.role === 'employee' && document.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const metadata = await db.getDocumentMetadata(id);
    if (!metadata) {
      return res.status(404).json({ error: 'Metadata not found' });
    }

    res.json(metadata);
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

// Get document analysis
router.get('/:id/analysis', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const document = await db.getDocument(new ObjectId(id));
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (req.user.role === 'employee' && document.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const analysis = await db.getAIAnalysis(id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json(analysis);
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// ─── File serving ────────────────────────────────────────────────────────────

// Helper: resolve and stream a PDF file
async function streamPDF(req, res, disposition) {
  const { id } = req.params;

  const document = await db.getDocument(new ObjectId(id));
  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  if (req.user.role === 'employee' && document.employee_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Resolve file path
  async function resolveExistingFile(filePathRaw) {
    const candidates = [];

    let normalized = filePathRaw;
    try {
      const uploadsToken = path.join('uploads', 'documents');
      const idx = filePathRaw.lastIndexOf(uploadsToken);
      if (idx !== -1) {
        normalized = filePathRaw.slice(idx);
      }
    } catch {}

    if (path.isAbsolute(filePathRaw)) candidates.push(filePathRaw);

    if (normalized !== filePathRaw) {
      candidates.push(path.join(process.cwd(), normalized));
      candidates.push(path.join(process.cwd(), 'backend', normalized));
      candidates.push(path.join(process.cwd(), '..', normalized));
    }

    candidates.push(path.join(process.cwd(), filePathRaw));
    candidates.push(path.join(process.cwd(), 'backend', filePathRaw));
    candidates.push(path.join(process.cwd(), '..', filePathRaw));
    candidates.push(filePathRaw);

    for (const c of candidates) {
      try {
        await fs.access(c);
        return c;
      } catch {}
    }
    return null;
  }

  const resolvedPath = await resolveExistingFile(document.file_path);
  if (!resolvedPath) {
    return res.status(404).json({ error: 'File not found on server' });
  }

  const stat = await fs.stat(resolvedPath);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `${disposition}; filename="${document.file_name}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  createReadStream(resolvedPath).pipe(res);
}

// Download (triggers browser save dialog)
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    await streamPDF(req, res, 'attachment');
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Preview (inline in iframe / new tab)
router.get('/:id/preview', authenticateToken, async (req, res) => {
  try {
    await streamPDF(req, res, 'inline');
  } catch (error) {
    console.error('Preview document error:', error);
    res.status(500).json({ error: 'Failed to preview document' });
  }
});

// ─── Admin management ────────────────────────────────────────────────────────

// Update document review status (Admin only)
router.put('/:id/review', authenticateToken, requireAdmin, auditLog('review', 'document'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await db.updateDocument(new ObjectId(id), {
      review_status: status,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    });

    const updated = await db.getDocument(new ObjectId(id));
    res.json(updated);
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ error: 'Failed to update review status' });
  }
});

// Delete document (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, auditLog('delete', 'document'), async (req, res) => {
  try {
    const { id } = req.params;

    const document = await db.getDocument(new ObjectId(id));
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete physical file
    const filePath = path.join(process.cwd(), document.file_path);
    try {
      await fs.unlink(filePath);
    } catch (fileErr) {
      console.warn('Could not delete physical file:', fileErr.message);
    }

    // Delete related records (cascade)
    await db.deleteDocument(new ObjectId(id));
    
    // Also delete related metadata, analysis, etc.
    // Note: These would need similar delete functions in db.js or we do them directly

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Replace document PDF (Admin only)
router.put(
  '/:id/replace',
  authenticateToken,
  requireAdmin,
  fileUpload({ limits: { fileSize: 20 * 1024 * 1024 } }),
  auditLog('replace', 'document'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const uploadedFile = req.files.file;

      if (!uploadedFile.name.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'Only PDF files are allowed' });
      }

      const document = await db.getDocument(new ObjectId(id));
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Delete old physical file
      const oldFilePath = path.join(process.cwd(), document.file_path);
      try {
        await fs.unlink(oldFilePath);
      } catch (fileErr) {
        console.warn('Could not delete old file:', fileErr.message);
      }

      // Save new file in same directory
      const docDir = path.dirname(oldFilePath);
      await fs.mkdir(docDir, { recursive: true });

      const newFileName = uploadedFile.name;
      const newFilePath = path.join(docDir, newFileName);
      await uploadedFile.mv(newFilePath);

      // Relative path
      const relativePath = path.join(
        'uploads', 'documents',
        ...document.file_path.split(path.sep).slice(2, -1),
        newFileName
      );

      // Re-parse PDF to update metadata
      const pdfBuffer = await fs.readFile(newFilePath);
      let extractedData = {};
      let rawText = '';
      try {
        const pdfData = await pdf(pdfBuffer, { max: 0 });
        rawText = pdfData.text;
        extractedData = processForm16(rawText);
      } catch (pdfErr) {
        console.warn('PDF re-parse warning:', pdfErr.message);
      }

      // Update document record
      await db.updateDocument(new ObjectId(id), {
        file_path: relativePath,
        file_name: newFileName,
        file_size: pdfBuffer.length,
        uploaded_at: new Date(),
      });

      // Update metadata
      await db.updateDocumentMetadata(id, {
        raw_text: rawText,
        parsed_json: extractedData,
        confidence_score: 0.85,
      });

      // Regenerate AI analysis
      try {
        const analysis = await generateAIAnalysis(extractedData);
        if (analysis) {
          await db.updateAIAnalysis(id, {
            salary_summary: analysis.salary_summary,
            tax_summary: analysis.tax_summary,
            investment_summary: analysis.investment_summary,
            observations: analysis.observations,
            employee_explanation: analysis.employee_explanation,
          });
        }
      } catch (aiErr) {
        console.warn('AI re-analysis skipped:', aiErr.message);
      }

      const updated = await db.getDocument(new ObjectId(id));
      res.json({ message: 'Document replaced successfully', document: updated });
    } catch (error) {
      console.error('Replace document error:', error);
      res.status(500).json({ error: 'Failed to replace document' });
    }
  }
);

export default router;
