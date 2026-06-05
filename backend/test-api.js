import fetch from 'node-fetch';
import pool from './backend/src/config/database.js';
import jwt from 'jsonwebtoken';

async function test() {
  // Get a document ID
  const [docs] = await pool.query('SELECT id FROM documents LIMIT 1');
  const docId = docs[0]?.id;
  
  console.log('Document ID:', docId);
  
  if (!docId) {
    console.log('No documents found');
    process.exit(0);
  }

  // Create a valid token
  const token = jwt.sign(
    { id: '85986953-d536-413a-809a-1a53869e645c', role: 'employee', name: 'JAY PRAKASH OJHA' },
    process.env.JWT_SECRET || 'test-secret'
  );
  
  console.log('Token:', token);
  
  // Test API call
  try {
    const response = await fetch(`http://localhost:5002/api/documents/${docId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

test();
