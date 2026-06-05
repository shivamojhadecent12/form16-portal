import express from 'express';
import * as db from '../services/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard stats (Admin only)
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const employees = await db.getAllEmployees(0, 10000);
    const documents = await db.getAllDocuments(0, 10000);
    const partACount = documents.filter(d => d.document_type === 'form16_partA').length;
    const partBCount = documents.filter(d => d.document_type === 'form16_partB').length;
    const pendingReviews = documents.filter(d => d.review_status === 'pending').length;

    const importJobs = await db.getImportJobs(0, 10000);
    const activeImports = importJobs.filter(j => ['pending', 'processing'].includes(j.status)).length;

    res.json({
      total_employees: employees.length,
      total_documents: documents.length,
      form16_partA: partACount,
      form16_partB: partBCount,
      pending_reviews: pendingReviews,
      active_imports: activeImports,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get audit logs (Admin only)
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await db.getAuditLogs(0, 100);
    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get settings (Admin only)
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await db.getAllSettings();
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update setting (Admin only)
router.put('/settings/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    await db.updateSetting(key, value);

    const updated = await db.getSetting(key);
    res.json(updated);
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
