import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { generateUUID } from '../utils/uuid.js';

const router = express.Router();

// Normalize PAN: uppercase, trim
function normalizePAN(pan) {
  return pan.toUpperCase().trim();
}

// Normalize Name: lowercase, trim
function normalizeName(name) {
  return name.toLowerCase().trim();
}

// Admin Login
router.post('/login/admin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get admin
    const [admins] = await pool.query(
      'SELECT * FROM admins WHERE email = ?',
      [email]
    );

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const admin = admins[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: admin.id, role: 'admin', email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: admin.id,
        role: 'admin',
        email: admin.email,
        name: admin.name,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Employee Login
router.post('/login/employee', async (req, res) => {
  try {
    const { pan, name } = req.body;

    if (!pan || !name) {
      return res.status(400).json({ error: 'PAN and name required' });
    }

    const normalizedPAN = normalizePAN(pan);
    const normalizedName = normalizeName(name);

    // Get employee
    const [employees] = await pool.query(
      'SELECT * FROM employees WHERE pan = ? AND name_normalized = ?',
      [normalizedPAN, normalizedName]
    );

    if (employees.length === 0) {
      return res.status(401).json({ error: 'Invalid PAN or Employee Name' });
    }

    const employee = employees[0];

    // Generate JWT
    const token = jwt.sign(
      { id: employee.id, role: 'employee', pan: employee.pan },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: employee.id,
        role: 'employee',
        name: employee.name,
        pan: employee.pan,
      },
    });
  } catch (error) {
    console.error('Employee login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify Token
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get fresh user data
    if (decoded.role === 'admin') {
      const [admins] = await pool.query('SELECT id, email, name FROM admins WHERE id = ?', [decoded.id]);
      if (admins.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }
      return res.json({ user: { ...admins[0], role: 'admin' } });
    } else {
      const [employees] = await pool.query('SELECT id, pan, name FROM employees WHERE id = ?', [decoded.id]);
      if (employees.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }
      return res.json({ user: { ...employees[0], role: 'employee' } });
    }
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
});

export default router;
