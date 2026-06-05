import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';

async function testExtraction(pdfPath) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📄 Testing: ${path.basename(pdfPath)}`);
  console.log(`${'='.repeat(70)}\n`);
  
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  const pdfText = data.text;
  
  // NEW TABLE-BASED EXTRACTION LOGIC
  const lines = pdfText.split('\n');
  let totalAmountPaid = undefined;
  let quarterlyAmounts = [];
  
  // Look for patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.match(/Total\s*\(Rs\.\)/i)) {
      console.log(`Found Total line: "${line}"`);
      const nums = line.match(/\d+(?:\.\d+)?/g) || [];
      console.log(`  Extracted numbers: ${nums}`);
      if (nums.length >= 2) {
        totalAmountPaid = parseFloat(nums[nums.length - 1]);
        console.log(`  → Total Amount: ${totalAmountPaid}`);
      }
    }
    
    if (line.match(/\bQ[1-4]\b/i)) {
      console.log(`Found quarterly line: "${line}"`);
      const nums = line.match(/(\d+(?:,\d+)*(?:\.\d+)?)/g) || [];
      console.log(`  Extracted: ${nums}`);
      nums.forEach(n => {
        const amount = parseFloat(n.replace(/,/g, ''));
        if (amount >= 50000 && amount <= 2000000) {
          quarterlyAmounts.push(amount);
          console.log(`    → ${amount}`);
        }
      });
    }
  }
  
  console.log(`\n💰 FINAL EXTRACTION:`);
  console.log(`  Gross Salary: ${totalAmountPaid ? `₹${totalAmountPaid.toLocaleString('en-IN')}` : 'NOT FOUND'}`);
  console.log(`  Quarterly Amounts: ${quarterlyAmounts}`);
  if (!totalAmountPaid && quarterlyAmounts.length > 0) {
    const sum = quarterlyAmounts.reduce((a, b) => a + b, 0);
    console.log(`  Sum of Quarterly: ₹${sum.toLocaleString('en-IN')}`);
  }
}

// Test PDFs
const testPdfs = [
  '/Users/shivamojha/Desktop/Test/form16-portal/backend/uploads/documents/AAPPF9976K/2025-26/form16_partA/AAPPF9976K_2025-26_fake.pdf'
];

for (const pdf of testPdfs) {
  if (fs.existsSync(pdf)) {
    await testExtraction(pdf);
  }
}
