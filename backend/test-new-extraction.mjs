import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The new extraction logic
function extractAllNumbers(text) {
  // Extract all numbers (4-8 digits, allowing commas and decimals)
  const matches = text.match(/\b(\d{4,8}(?:[,\.]\d{1,2})?)\b/g) || [];
  const numbers = matches
    .map(m => parseFloat(m.replace(/,/g, '')))
    .filter(n => n >= 50000 && n <= 5000000); // Realistic salary range
  
  console.log('✓ Extracted candidate numbers:', numbers);
  return numbers;
}

async function testExtraction(pdfPath) {
  console.log(`\n📄 Testing: ${path.basename(pdfPath)}\n`);
  
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const pdfText = data.text;
    
    console.log('📋 PDF Text (first 500 chars):');
    console.log(pdfText.substring(0, 500));
    console.log('\n---\n');
    
    const allNumbers = extractAllNumbers(pdfText);
    
    // Try to find salary pair
    const recentNumbers = allNumbers.slice(-10);
    console.log('📊 Last 10 candidates:', recentNumbers);
    
    let foundPair = false;
    let grossSalary, netSalary;
    
    for (let i = 0; i < recentNumbers.length - 1; i++) {
      const current = recentNumbers[i];
      const next = recentNumbers[i + 1];
      
      const ratio = current / next;
      console.log(`  Checking pair: ${current} → ${next} (ratio: ${ratio.toFixed(2)})`);
      
      // If we find a number followed by a smaller number, it might be gross -> net
      if (current > next && ratio >= 1.1 && ratio <= 2.0) {
        console.log(`  ✅ MATCH! Gross: ${current}, Net: ${next}`);
        grossSalary = current;
        netSalary = next;
        foundPair = true;
        break;
      }
    }
    
    if (!foundPair) {
      console.log(`  No pair found using ratio method`);
      grossSalary = Math.max(...allNumbers);
      netSalary = allNumbers.length > 1 ? Math.max(...allNumbers.filter(n => n !== grossSalary)) : undefined;
      console.log(`  Using max values: Gross: ${grossSalary}, Net: ${netSalary}`);
    }
    
    console.log('\n💰 EXTRACTED:');
    console.log(`  Gross Salary: ₹${grossSalary?.toLocaleString('en-IN') || 'N/A'}`);
    console.log(`  Net Salary: ₹${netSalary?.toLocaleString('en-IN') || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test with available PDFs - find them recursively
const uploadsDir = path.join(__dirname, 'uploads/documents');
let pdfFiles = [];

function findPdfs(dir) {
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        findPdfs(fullPath);
      } else if (entry.endsWith('.pdf')) {
        pdfFiles.push(fullPath);
      }
    }
  } catch (e) {
    // Ignore errors
  }
}

if (fs.existsSync(uploadsDir)) {
  findPdfs(uploadsDir);
  pdfFiles = pdfFiles.slice(0, 3); // Test first 3 PDFs
  
  console.log(`Testing ${pdfFiles.length} PDF(s) with NEW extraction logic:\n`);
  
  for (const file of pdfFiles) {
    await testExtraction(file);
  }
} else {
  console.log('❌ No uploads directory found');
}
