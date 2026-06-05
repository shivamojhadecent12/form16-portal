import pool from './src/config/database.js';
import fs from 'fs/promises';

async function test() {
  try {
    // Check if large ZIP file exists
    const largeZipPath = '/Users/shivamojha/Desktop/Test/form16-portal/backend/uploads/imports/1780237585841_FORM-16 PART-A & B  25-26.zip';
    
    try {
      const stats = await fs.stat(largeZipPath);
      console.log('✅ Large ZIP file found:', largeZipPath);
      console.log('   Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
    } catch (err) {
      console.log('⚠️ Large ZIP file not found, checking any recent imports...');
    }

    // Get import jobs
    const [jobs] = await pool.query(
      'SELECT id, file_name, status, total_files, successful_files, failed_files, error_message FROM import_jobs ORDER BY created_at DESC LIMIT 5'
    );

    console.log('\n📊 Recent Import Jobs:');
    jobs.forEach((job, idx) => {
      console.log(`\n${idx + 1}. ${job.file_name}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Files: ${job.total_files} total, ${job.successful_files} success, ${job.failed_files} failed`);
      if (job.error_message) {
        console.log(`   Error: ${job.error_message}`);
      }
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

test();
