import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as db from '../services/db.js';

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

    // Get admin from MongoDB
    const admin = await db.getAdmin(email);

    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: admin._id.toString(), role: 'admin', email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: admin._id.toString(),
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

    // Get employee from MongoDB
    const employee = await db.getEmployee(normalizedPAN);

    if (!employee || employee.name_normalized !== normalizedName) {
      return res.status(401).json({ error: 'Invalid PAN or Employee Name' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: employee._id.toString(), role: 'employee', pan: employee.pan },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: employee._id.toString(),
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
    
    // Get fresh user data from MongoDB
    if (decoded.role === 'admin') {
      const admin = await db.getAdminById(decoded.id);
      if (!admin) {
        return res.status(401).json({ error: 'User not found' });
      }
      return res.json({
        user: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          role: 'admin',
        },
      });
    } else {
      const employee = await db.getEmployeeById(decoded.id);
      if (!employee) {
        return res.status(401).json({ error: 'User not found' });
      }
      return res.json({
        user: {
          id: employee._id,
          pan: employee.pan,
          name: employee.name,
          role: 'employee',
        },
      });
    }
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
});

export default router;
