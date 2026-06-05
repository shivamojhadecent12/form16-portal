import pool from './src/config/database.js';

try {
  const [docs] = await pool.query('SELECT id, file_name, employee_id, financial_year FROM documents LIMIT 5');
  console.log('Documents in database:');
  console.log(JSON.stringify(docs, null, 2));
  
  const [employees] = await pool.query('SELECT id, name, pan FROM employees LIMIT 5');
  console.log('\nEmployees in database:');
  console.log(JSON.stringify(employees, null, 2));
  
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
