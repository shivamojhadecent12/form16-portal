import express from 'express';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import fileUpload from 'express-fileupload';
import pdf from 'pdf-parse';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin, checkOwnership } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { generateUUID } from '../utils/uuid.js';
import { processForm16 } from '../services/pdfProcessor.js';
import { generateAIAnalysis } from '../services/aiService.js';

const router = express.Router();

// ─── IMPORTANT: specific routes MUST come before /:id ───────────────────────

// Get pending reviews (Admin only) — must be before /:id
router.get('/reviews/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [documents] = await pool.query(
      `SELECT d.*, e.name as employee_name, e.pan as employee_pan
       FROM documents d
       JOIN employees e ON d.employee_id = e.id
       WHERE d.review_status = 'pending'
       ORDER BY d.uploaded_at DESC`
    );
    res.json(documents);
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});

// ─── Collection routes ───────────────────────────────────────────────────────

// Get all documents
router.get('/', authenticateToken, checkOwnership, async (req, res) => {
  try {
    let query = `
      SELECT d.*, e.name as employee_name, e.pan as employee_pan
      FROM documents d
      JOIN employees e ON d.employee_id = e.id
    `;
    const params = [];

    // If employeeId is provided in query, filter by that
    if (req.query.employeeId) {
      query += ' WHERE d.employee_id = ?';
      params.push(req.query.employeeId);
    } else if (req.user.role === 'employee') {
      // If no employeeId but user is employee, filter by their own ID
      query += ' WHERE d.employee_id = ?';
      params.push(req.user.id);
    }
    // If admin and no employeeId, return all documents

    query += ' ORDER BY d.uploaded_at DESC';

    const [documents] = await pool.query(query, params);
    res.json(documents);
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

    const [documents] = await pool.query(
      `SELECT d.*, e.name as employee_name, e.pan as employee_pan
       FROM documents d
       JOIN employees e ON d.employee_id = e.id
       WHERE d.id = ?`,
      [id]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];

    if (req.user.role === 'employee' && document.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Get document metadata
router.get('/:id/metadata', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [documents] = await pool.query('SELECT employee_id FROM documents WHERE id = ?', [id]);
    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (req.user.role === 'employee' && documents[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [metadata] = await pool.query(
      'SELECT * FROM document_metadata WHERE document_id = ?',
      [id]
    );

    if (metadata.length === 0) {
      return res.status(404).json({ error: 'Metadata not found' });
    }

    // Parse JSON fields if stored as strings
    const row = metadata[0];
    if (typeof row.parsed_json === 'string') {
      try { row.parsed_json = JSON.parse(row.parsed_json); } catch {}
    }

    res.json(row);
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

// Get document analysis
router.get('/:id/analysis', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [documents] = await pool.query('SELECT employee_id FROM documents WHERE id = ?', [id]);
    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (req.user.role === 'employee' && documents[0].employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [analysis] = await pool.query(
      'SELECT * FROM ai_analysis WHERE document_id = ?',
      [id]
    );

    if (analysis.length === 0) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // Parse JSON fields
    const row = analysis[0];
    ['salary_summary', 'tax_summary', 'investment_summary', 'observations'].forEach((field) => {
      if (typeof row[field] === 'string') {
        try { row[field] = JSON.parse(row[field]); } catch {}
      }
    });

    res.json(row);
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// ─── File serving ────────────────────────────────────────────────────────────

// Helper: resolve and stream a PDF file
async function streamPDF(req, res, disposition) {
  const { id } = req.params;

  // At this point, middleware has already verified the token (from header or query param)
  // and set req.user, so we can safely assume authentication is complete

  const [documents] = await pool.query('SELECT * FROM documents WHERE id = ?', [id]);
  if (documents.length === 0) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const document = documents[0];

  if (req.user.role === 'employee' && document.employee_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Resolve file path: try several candidates so imports/uploads under backend/ or repo root both work
  async function resolveExistingFile(filePathRaw) {
    const candidates = [];

    // If filePathRaw contains repeated prefixes (e.g. saved with an absolute/duplicated path),
    // try to find the last occurrence of 'uploads' and use that relative slice.
    let normalized = filePathRaw;
    try {
      const uploadsToken = path.join('uploads', 'documents');
      const idx = filePathRaw.lastIndexOf(uploadsToken);
      if (idx !== -1) {
        normalized = filePathRaw.slice(idx);
      }
    } catch {}

    // If filePathRaw is absolute, test it first
    if (path.isAbsolute(filePathRaw)) candidates.push(filePathRaw);

    // If normalized is different, try normalized relative to cwd and other likely roots
    if (normalized !== filePathRaw) {
      candidates.push(path.join(process.cwd(), normalized));
      candidates.push(path.join(process.cwd(), 'backend', normalized));
      candidates.push(path.join(process.cwd(), '..', normalized));
    }

    // Try raw relative and under backend/ and parent dir
    candidates.push(path.join(process.cwd(), filePathRaw));
    candidates.push(path.join(process.cwd(), 'backend', filePathRaw));
    candidates.push(path.join(process.cwd(), '..', filePathRaw));

    // Finally try the raw value itself
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

    await pool.query(
      `UPDATE documents SET review_status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
      [status, req.user.id, id]
    );

    const [updated] = await pool.query('SELECT * FROM documents WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ error: 'Failed to update review status' });
  }
});

// Delete document (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, auditLog('delete', 'document'), async (req, res) => {
  try {
    const { id } = req.params;

    const [documents] = await pool.query('SELECT * FROM documents WHERE id = ?', [id]);
    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];

    // Delete physical file
    const filePath = path.join(process.cwd(), document.file_path);
    try {
      await fs.unlink(filePath);
    } catch (fileErr) {
      console.warn('Could not delete physical file:', fileErr.message);
    }

  // Delete related records (cascade). Remove import_job_logs and chat_history first to satisfy FK constraints.
  await pool.query('DELETE FROM ai_analysis WHERE document_id = ?', [id]);
  await pool.query('DELETE FROM document_metadata WHERE document_id = ?', [id]);
  await pool.query('DELETE FROM import_job_logs WHERE document_id = ?', [id]);
  await pool.query('DELETE FROM chat_history WHERE document_id = ?', [id]);
  await pool.query('DELETE FROM documents WHERE id = ?', [id]);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Replace document PDF (Admin only) — upload a new PDF for an existing document record
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

      const [documents] = await pool.query('SELECT * FROM documents WHERE id = ?', [id]);
      if (documents.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const document = documents[0];

      // Delete old physical file
      const oldFilePath = path.join(process.cwd(), document.file_path);
      try {
        await fs.unlink(oldFilePath);
      } catch (fileErr) {
        console.warn('Could not delete old file:', fileErr.message);
      }

      // Save new file in same directory, keep new filename
      const docDir = path.dirname(oldFilePath);
      await fs.mkdir(docDir, { recursive: true });

      const newFileName = uploadedFile.name;
      const newFilePath = path.join(docDir, newFileName);
      await uploadedFile.mv(newFilePath);

      // Relative path
      const relativePath = path.join(
        'uploads', 'documents',
        ...document.file_path.split(path.sep).slice(2, -1), // keep pan/year/type dirs
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
      await pool.query(
        `UPDATE documents SET file_path = ?, file_name = ?, file_size = ?, uploaded_at = NOW() WHERE id = ?`,
        [relativePath, newFileName, pdfBuffer.length, id]
      );

      // Update metadata
      await pool.query('DELETE FROM document_metadata WHERE document_id = ?', [id]);
      const metadataId = generateUUID();
      await pool.query(
        `INSERT INTO document_metadata (id, document_id, raw_text, parsed_json, confidence_score)
         VALUES (?, ?, ?, ?, ?)`,
        [metadataId, id, rawText, JSON.stringify(extractedData), 0.85]
      );

      // Regenerate AI analysis
      await pool.query('DELETE FROM ai_analysis WHERE document_id = ?', [id]);
      try {
        const analysis = await generateAIAnalysis(extractedData);
        if (analysis) {
          const analysisId = generateUUID();
          await pool.query(
            `INSERT INTO ai_analysis (id, document_id, salary_summary, tax_summary, investment_summary, observations, employee_explanation)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              analysisId, id,
              JSON.stringify(analysis.salary_summary),
              JSON.stringify(analysis.tax_summary),
              JSON.stringify(analysis.investment_summary),
              JSON.stringify(analysis.observations),
              analysis.employee_explanation,
            ]
          );
        }
      } catch (aiErr) {
        console.warn('AI re-analysis skipped:', aiErr.message);
      }

      const [updated] = await pool.query('SELECT * FROM documents WHERE id = ?', [id]);
      res.json({ message: 'Document replaced successfully', document: updated[0] });
    } catch (error) {
      console.error('Replace document error:', error);
      res.status(500).json({ error: 'Failed to replace document' });
    }
  }
);

export default router;
