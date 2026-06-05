import express from 'express';
import * as db from '../services/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { generateUUID } from '../utils/uuid.js';
import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';

const router = express.Router();

// Get all employees (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const employees = await db.getAllEmployees();
    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Bulk delete employees (Admin only)
router.post('/bulk/delete', authenticateToken, requireAdmin, auditLog('bulk-delete', 'employees'), async (req, res) => {
  try {
    const { employeeIds } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'Invalid employee IDs provided' });
    }

    if (employeeIds.length > 5000) {
      return res.status(400).json({ error: 'Cannot delete more than 5000 employees at once' });
    }

    const employees = await Promise.all(
      employeeIds.map(id => db.getEmployeeById(new ObjectId(id)))
    );

    const validEmployees = employees.filter(emp => emp !== null);

    if (validEmployees.length === 0) {
      return res.status(404).json({ error: 'No employees found for deletion' });
    }

    // Get all documents for these employees
    const documentsList = await Promise.all(
      employeeIds.map(id => db.getDocumentsByEmployee(new ObjectId(id)))
    );
    const documents = documentsList.flat();

    try {
      // Delete all related records for each document
      for (const doc of documents) {
        await db.deleteDocument(doc._id);
      }

      // Delete employee data
      for (const empId of employeeIds) {
        await db.deleteEmployee(new ObjectId(empId));
      }

      // Delete files
      for (const doc of documents) {
        try {
          await fs.unlink(doc.file_path);
        } catch (e) {
          console.warn(`Could not delete file: ${doc.file_path}`, e.message);
        }
      }

      // Remove employee directories
      for (const emp of validEmployees) {
        if (emp.pan) {
          try {
            const empDir = path.join(process.cwd(), 'uploads', 'documents', emp.pan);
            await fs.rmdir(empDir, { recursive: true });
          } catch (e) {
            console.warn(`Could not remove directory for ${emp.pan}`, e.message);
          }
        }
      }

      return res.json({
        message: `Successfully deleted ${employeeIds.length} employees and ${documents.length} documents`,
        deletedEmployees: employeeIds.length,
        deletedDocuments: documents.length,
      });
    } catch (dbErr) {
      console.error('Deletion error:', dbErr);
      return res.status(500).json({ error: 'Failed to delete employees' });
    }
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to process bulk deletion' });
  }
});

// Get employee by ID (Admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const employee = await db.getEmployeeById(new ObjectId(req.params.id));

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Get employee profile
router.get('/:id/profile', authenticateToken, async (req, res) => {
  try {
    const employee = await db.getEmployeeById(new ObjectId(req.params.id));

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const profile = await db.getEmployeeProfile(new ObjectId(req.params.id));

    res.json({
      ...employee,
      profile: profile || {},
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update employee profile
router.put('/:id/profile', authenticateToken, async (req, res) => {
  try {
    const { phone, email, address, dateOfBirth, joiningDate } = req.body;
    const employeeId = req.params.id;

    // Verify the employee exists and user has access
    const employee = await db.getEmployeeById(new ObjectId(employeeId));
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if user is updating their own profile or is admin
    if (req.user.role === 'employee' && req.user.id !== employeeId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get or create profile
    let profile = await db.getEmployeeProfile(employeeId);

    if (!profile) {
      const newProfile = {
        _id: generateUUID(),
        employee_id: employeeId,
        phone,
        email,
        address,
        date_of_birth: dateOfBirth,
        joining_date: joiningDate,
        created_at: new Date(),
        updated_at: new Date(),
      };
      await db.createEmployeeProfile(newProfile);
      return res.json(newProfile);
    } else {
      await db.updateEmployeeProfile(employeeId, {
        phone,
        email,
        address,
        date_of_birth: dateOfBirth,
        joining_date: joiningDate,
        updated_at: new Date(),
      });
      const updatedProfile = await db.getEmployeeProfile(employeeId);
      return res.json(updatedProfile);
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get employee documents
router.get('/:id/documents', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.params.id;

    // Verify access
    const employee = await db.getEmployeeById(new ObjectId(employeeId));
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (req.user.role === 'employee' && req.user.id !== employeeId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const documents = await db.getDocumentsByEmployee(employeeId);
    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Delete employee (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, auditLog('delete', 'employees'), async (req, res) => {
  try {
    const employee = await db.getEmployeeById(new ObjectId(req.params.id));

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get documents
    const documents = await db.getDocumentsByEmployee(new ObjectId(req.params.id));

    // Delete documents
    for (const doc of documents) {
      await db.deleteDocument(doc._id);
      
      // Delete file
      try {
        await fs.unlink(doc.file_path);
      } catch (e) {
        console.warn(`Could not delete file: ${doc.file_path}`);
      }
    }

    // Delete employee
    await db.deleteEmployee(new ObjectId(req.params.id));

    // Clean up directory
    try {
      const empDir = path.join(process.cwd(), 'uploads', 'documents', employee.pan);
      await fs.rmdir(empDir, { recursive: true });
    } catch (e) {
      console.warn(`Could not remove directory for ${employee.pan}`);
    }

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

export default router;
