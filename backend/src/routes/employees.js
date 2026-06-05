import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { generateUUID } from '../utils/uuid.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Get all employees (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [employees] = await pool.query(
      'SELECT * FROM employees ORDER BY created_at DESC'
    );
    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Bulk delete employees (Admin only) - MUST BE BEFORE /:id routes!
router.post('/bulk/delete', authenticateToken, requireAdmin, auditLog('bulk-delete', 'employees'), async (req, res) => {
  try {
    const { employeeIds } = req.body;

    // Validate input
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'Invalid employee IDs provided' });
    }

    if (employeeIds.length > 5000) {
      return res.status(400).json({ error: 'Cannot delete more than 5000 employees at once' });
    }

    // Fetch all employees to verify existence
    const placeholders = employeeIds.map(() => '?').join(',');
    const [employees] = await pool.query(
      `SELECT id, pan FROM employees WHERE id IN (${placeholders})`,
      employeeIds
    );

    if (employees.length === 0) {
      return res.status(404).json({ error: 'No employees found for deletion' });
    }

    // Fetch documents for all employees
    const [documents] = await pool.query(
      `SELECT id, employee_id, file_path FROM documents WHERE employee_id IN (${placeholders})`,
      employeeIds
    );

    const docIds = documents.map(d => d.id);

    // Delete all related records
    try {
      if (docIds.length > 0) {
        const docPlaceholders = docIds.map(() => '?').join(',');
        await pool.query(`DELETE FROM ai_analysis WHERE document_id IN (${docPlaceholders})`, docIds);
        await pool.query(`DELETE FROM document_metadata WHERE document_id IN (${docPlaceholders})`, docIds);
        await pool.query(`DELETE FROM import_job_logs WHERE document_id IN (${docPlaceholders})`, docIds);
        await pool.query(`DELETE FROM chat_history WHERE document_id IN (${docPlaceholders})`, docIds);
        await pool.query(`DELETE FROM documents WHERE id IN (${docPlaceholders})`, docIds);
      }

      const empPlaceholders = employeeIds.map(() => '?').join(',');
      await pool.query(`DELETE FROM employee_profiles WHERE employee_id IN (${empPlaceholders})`, employeeIds);
      await pool.query(`DELETE FROM chat_history WHERE employee_id IN (${empPlaceholders})`, employeeIds);
      await pool.query(`DELETE FROM audit_logs WHERE user_id IN (${empPlaceholders})`, employeeIds);
      await pool.query(`DELETE FROM employees WHERE id IN (${empPlaceholders})`, employeeIds);

      // Delete files in uploads
      for (const doc of documents) {
        try {
          await fs.unlink(doc.file_path);
        } catch (e) {
          console.warn(`Could not delete file: ${doc.file_path}`, e.message);
        }
      }

      // Remove employee upload directories if empty
      for (const emp of employees) {
        if (emp.pan) {
          try {
            const empDir = path.join(process.cwd(), 'uploads', 'documents', emp.pan);
            await fs.rmdir(empDir);
          } catch (e) {
            console.warn(`Could not remove directory for ${emp.pan}`, e.message);
          }
        }
      }

      return res.json({
        message: `Successfully deleted ${employeeIds.length} employees and ${documents.length} documents`,
        deletedEmployees: employeeIds.length,
        deletedDocuments: documents.length
      });
    } catch (dbErr) {
      console.error('Bulk delete error:', dbErr);
      return res.status(500).json({ error: 'Failed to delete employees', details: dbErr.message });
    }
  } catch (error) {
    console.error('Bulk delete request error:', error);
    res.status(500).json({ error: 'Failed to process bulk delete request', details: error.message });
  }
});

// Get single employee
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check authorization
    if (req.user.role === 'employee' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [employees] = await pool.query(
      `SELECT e.*, ep.* 
       FROM employees e
       LEFT JOIN employee_profiles ep ON e.id = ep.employee_id
       WHERE e.id = ?`,
      [id]
    );

    if (employees.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employees[0]);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Update employee (Admin only)
router.put('/:id', authenticateToken, requireAdmin, auditLog('update', 'employee'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, designation, employer_name } = req.body;

    await pool.query(
      `UPDATE employees 
       SET name = ?, department = ?, designation = ?, employer_name = ?
       WHERE id = ?`,
      [name, department, designation, employer_name, id]
    );

    const [updated] = await pool.query('SELECT * FROM employees WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Delete employee (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, auditLog('delete', 'employee'), async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch employee to verify existence and get PAN (for file paths)
    const [employees] = await pool.query('SELECT * FROM employees WHERE id = ?', [id]);
    if (employees.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const employee = employees[0];

    // Fetch documents for employee
    const [documents] = await pool.query('SELECT id, file_path FROM documents WHERE employee_id = ?', [id]);

    const docIds = documents.map(d => d.id);

    // Resolve existing file helper (reuse same normalization used in documents route)
    async function resolveExistingFile(filePathRaw) {
      const candidates = [];
      let normalized = filePathRaw;
      try {
        const uploadsToken = path.join('uploads', 'documents');
        const idx = filePathRaw.lastIndexOf(uploadsToken);
        if (idx !== -1) normalized = filePathRaw.slice(idx);
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

    // Create trash dir and move files into it first (protect originals until DB ops succeed)
    const trashDir = path.join(process.cwd(), 'uploads', '.trash', `${Date.now()}_${id}`);
    await fs.mkdir(trashDir, { recursive: true });
    const movedFiles = []; // { docId, orig, trash }

    try {
      for (const doc of documents) {
        const resolved = await resolveExistingFile(doc.file_path);
        if (resolved) {
          const trashPath = path.join(trashDir, `${doc.id}_${path.basename(resolved)}`);
          await fs.rename(resolved, trashPath);
          movedFiles.push({ docId: doc.id, orig: resolved, trash: trashPath });
        } else {
          console.warn(`File not found for document ${doc.id} at any candidate path: ${doc.file_path}`);
        }
      }
    } catch (moveErr) {
      // Try to restore any moved files
      for (const m of movedFiles) {
        try { await fs.rename(m.trash, m.orig); } catch (e) { console.error('Restore failed:', e.message); }
      }
      // Clean up trash dir
      try { await fs.rm(trashDir, { recursive: true, force: true }); } catch {}
      console.error('Failed to move files to trash:', moveErr.message);
      return res.status(500).json({ error: 'Failed to prepare files for deletion' });
    }

    // Run DB deletes directly (no transaction for stability)
    try {
      if (docIds.length > 0) {
        const placeholders = docIds.map(() => '?').join(',');
        await pool.query(`DELETE FROM ai_analysis WHERE document_id IN (${placeholders})`, docIds);
        await pool.query(`DELETE FROM document_metadata WHERE document_id IN (${placeholders})`, docIds);
        await pool.query(`DELETE FROM import_job_logs WHERE document_id IN (${placeholders})`, docIds);
        await pool.query(`DELETE FROM chat_history WHERE document_id IN (${placeholders})`, docIds);
        await pool.query(`DELETE FROM documents WHERE id IN (${placeholders})`, docIds);
      }

      await pool.query('DELETE FROM employee_profiles WHERE employee_id = ?', [id]);
      await pool.query('DELETE FROM chat_history WHERE employee_id = ?', [id]);
      await pool.query('DELETE FROM audit_logs WHERE user_id = ?', [id]);
      await pool.query('DELETE FROM employees WHERE id = ?', [id]);

      // On success, permanently delete files in trash
      for (const m of movedFiles) {
        try { await fs.unlink(m.trash); } catch (e) { console.warn('Could not permanently remove:', m.trash, e.message); }
      }
      try { await fs.rm(trashDir, { recursive: true, force: true }); } catch {}

      // Try to remove the employee upload directory if empty (best-effort)
      try {
        if (employee.pan) {
          const empDir = path.join(process.cwd(), 'uploads', 'documents', employee.pan);
          await fs.rmdir(empDir).catch(() => {});
        }
      } catch {}

      return res.json({ message: 'Employee and related data deleted successfully' });
    } catch (dbErr) {
      // Restore files on error
      for (const m of movedFiles) {
        try { await fs.rename(m.trash, m.orig); } catch (e) { console.error('Restore after error failed:', e.message); }
      }
      try { await fs.rm(trashDir, { recursive: true, force: true }); } catch {}
      console.error('DB delete failed:', dbErr.message);
      return res.status(500).json({ error: 'Failed to delete employee records', details: dbErr.message });
    }
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

export default router;
