console.log('1. Starting import test...');

console.log('2. Importing express...');
import('express').then(() => {
  console.log('   ✓ express imported');
}).catch(err => console.error('   ✗ Error:', err.message));

console.log('3. Importing cors...');
import('cors').then(() => {
  console.log('   ✓ cors imported');
}).catch(err => console.error('   ✗ Error:', err.message));

console.log('4. Importing dotenv...');
import('dotenv').then(() => {
  console.log('   ✓ dotenv imported');
}).catch(err => console.error('   ✗ Error:', err.message));

console.log('5. Importing config/database.js...');
import('./src/config/database.js').then(() => {
  console.log('   ✓ database imported');
}).catch(err => console.error('   ✗ Error:', err.message));

console.log('6. Importing routes/auth.js...');
import('./src/routes/auth.js').then(() => {
  console.log('   ✓ auth routes imported');
}).catch(err => console.error('   ✗ Error:', err.message));

console.log('7. Importing routes/employees.js...');
import('./src/routes/employees.js').then(() => {
  console.log('   ✓ employees routes imported');
}).catch(err => console.error('   ✗ Error:', err.message));

console.log('8. Importing routes/documents.js...');
import('./src/routes/documents.js').then(() => {
  console.log('   ✓ documents routes imported');
}).catch(err => console.error('   ✗ Error:', err.message));

console.log('9. Importing routes/import.js...');
import('./src/routes/import.js').then(() => {
  console.log('   ✓ import routes imported');
}).catch(err => console.error('   ✗ Error:', err.message));

console.log('10. Importing routes/chat.js...');
import('./src/routes/chat.js').then(() => {
  console.log('   ✓ chat routes imported');
}).catch(err => console.error('   ✗ Error:', err.message));

console.log('11. Importing routes/dashboard.js...');
import('./src/routes/dashboard.js').then(() => {
  console.log('   ✓ dashboard routes imported');
}).catch(err => console.error('   ✗ Error:', err.message));

setTimeout(() => {
  console.log('\nAll imports completed!');
  process.exit(0);
}, 5000);
