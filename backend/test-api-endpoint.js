import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

async function test() {
  const token = jwt.sign(
    { 
      id: '85986953-d536-413a-809a-1a53869e645c', 
      role: 'employee', 
      pan: 'AALPO1965B' 
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '24h' }
  );

  console.log('Testing GET /api/documents endpoint...\n');
  
  try {
    const response = await fetch('http://localhost:5002/api/documents', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n\nTesting GET /api/documents/{id} endpoint...\n');
  
  try {
    const response = await fetch('http://localhost:5002/api/documents/1a6117ee-579c-4459-97bd-4b9d65b4e081', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

test();
