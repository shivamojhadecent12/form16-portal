import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireEmployee } from '../middleware/auth.js';
import { chatWithDocument } from '../services/aiService.js';
import { generateUUID } from '../utils/uuid.js';

const router = express.Router();

// Get chat history
router.get('/', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { documentId } = req.query;

    let query = 'SELECT * FROM chat_history WHERE employee_id = ?';
    const params = [req.user.id];

    if (documentId) {
      query += ' AND document_id = ?';
      params.push(documentId);
    }

    query += ' ORDER BY created_at ASC';

    const [history] = await pool.query(query, params);
    res.json(history);
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Send message
router.post('/', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { documentId, question } = req.body;

    if (!documentId || !question) {
      return res.status(400).json({ error: 'Document ID and question required' });
    }

    // Verify document ownership
    const [documents] = await pool.query(
      'SELECT * FROM documents WHERE id = ? AND employee_id = ?',
      [documentId, req.user.id]
    );

    if (documents.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get answer from AI
    const answer = await chatWithDocument(documentId, question);

    // Store in chat history
    const chatId = generateUUID();
    await pool.query(
      `INSERT INTO chat_history (id, employee_id, document_id, question, answer, context_used)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [chatId, req.user.id, documentId, question, answer, null]
    );

    res.json({
      id: chatId,
      employee_id: req.user.id,
      document_id: documentId,
      question,
      answer,
      created_at: new Date(),
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Clear chat history
router.delete('/', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { documentId } = req.query;

    let query = 'DELETE FROM chat_history WHERE employee_id = ?';
    const params = [req.user.id];

    if (documentId) {
      query += ' AND document_id = ?';
      params.push(documentId);
    }

    await pool.query(query, params);
    res.json({ message: 'Chat history cleared' });
  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

export default router;
