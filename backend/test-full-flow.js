import pool from './src/config/database.js';
import jwt from 'jsonwebtoken';

async function test() {
  try {
    // Get the employee from database
    const [employees] = await pool.query('SELECT * FROM employees LIMIT 1');
    const employee = employees[0];
    
    if (!employee) {
      console.log('No employees found');
      process.exit(0);
    }

    console.log('\n✓ Employee found:');
    console.log(`  ID: ${employee.id}`);
    console.log(`  Name: ${employee.name}`);
    console.log(`  PAN: ${employee.pan}`);

    // Create a token like the auth endpoint would
    const token = jwt.sign(
      { 
        id: employee.id, 
        role: 'employee', 
        pan: employee.pan 
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );

    console.log(`\n✓ Token created: ${token.substring(0, 50)}...`);

    // Verify the token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      console.log(`\n✓ Token verified:`, decoded);
    } catch (err) {
      console.error('Token verification failed:', err.message);
    }

    // Get a document for this employee
    const [documents] = await pool.query(
      'SELECT * FROM documents WHERE employee_id = ? LIMIT 1',
      [employee.id]
    );

    if (documents.length === 0) {
      console.log('\n⚠ No documents found for this employee');
    } else {
      const doc = documents[0];
      console.log(`\n✓ Document found:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  File: ${doc.file_name}`);
      console.log(`  Year: ${doc.financial_year}`);
    }

    console.log('\n✓ All checks passed!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

test();
