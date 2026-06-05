import express from 'express';
import { authenticateToken, requireEmployee } from '../middleware/auth.js';
import { chatWithDocument } from '../services/aiService.js';
import { generateUUID } from '../utils/uuid.js';
import db from '../services/db.js';

const router = express.Router();

// Get chat history
router.get('/', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { documentId } = req.query;
    const employeeId = req.user.id || req.user._id;

    let history;
    if (documentId) {
      history = await db.getChatHistory(employeeId, documentId);
    } else {
      history = await db.getChatHistory(employeeId);
    }

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
    const employeeId = req.user.id || req.user._id;

    if (!documentId || !question) {
      return res.status(400).json({ error: 'Document ID and question required' });
    }

    // Verify document ownership
    const document = await db.getDocumentById(documentId);

    if (!document || document.employee_id !== employeeId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get answer from AI
    const answer = await chatWithDocument(documentId, question);

    // Store in chat history
    const chatId = generateUUID();
    const chatMessage = {
      _id: chatId,
      employee_id: employeeId,
      document_id: documentId,
      question,
      answer,
      context_used: null,
      created_at: new Date(),
    };

    await db.createChatMessage(chatMessage);

    res.json(chatMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Clear chat history
router.delete('/', authenticateToken, requireEmployee, async (req, res) => {
  try {
    const { documentId } = req.query;
    const employeeId = req.user.id || req.user._id;

    if (documentId) {
      await db.deleteChatHistory(employeeId, documentId);
    } else {
      await db.deleteChatHistory(employeeId);
    }

    res.json({ message: 'Chat history cleared' });
  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

export default router;
