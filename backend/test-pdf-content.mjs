import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';

async function analyzePdf(pdfPath) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📄 Analyzing: ${path.basename(pdfPath)}`);
  console.log(`${'='.repeat(80)}\n`);
  
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const text = data.text;
    
    // Look for salary-related keywords
    const lines = text.split('\n');
    console.log('📋 Full PDF content (relevant sections):\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Show lines that might contain salary data
      if (line.toLowerCase().includes('gross') || 
          line.toLowerCase().includes('net') || 
          line.toLowerCase().includes('salary') ||
          line.toLowerCase().includes('income') ||
          line.toLowerCase().includes('deduction') ||
          line.toLowerCase().includes('tds') ||
          line.toLowerCase().includes('tax') ||
          line.match(/\d{5,}/)) {  // Lines with large numbers
        console.log(`Line ${i}: "${line}"`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test one specific PDF
const testPdf = '/Users/shivamojha/Desktop/Test/form16-portal/backend/uploads/documents/AAPPF9976K/2025-26/form16/AAPPF9976K_2025-26_fake.pdf';
if (fs.existsSync(testPdf)) {
  await analyzePdf(testPdf);
} else {
  console.log('PDF not found');
}
