import pdfParse from 'pdf-parse';
import fs from 'fs';

async function analyzePdf(pdfPath) {
  console.log(`\n📄 Analyzing: ${pdfPath}\n`);
  
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  const text = data.text;
  
  // Print the full text to see structure
  console.log('FULL PDF TEXT:');
  console.log(text);
}

await analyzePdf('/Users/shivamojha/Desktop/Test/form16-portal/backend/uploads/documents/AAPPF9976K/2025-26/form16_partA/AAPPF9976K_2025-26_fake.pdf');
