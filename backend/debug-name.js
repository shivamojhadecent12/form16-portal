import fs from 'fs/promises';
import pdf from 'pdf-parse';

const testFile = './uploads/documents/AALPO1965B/2024-25/form16/original.pdf';
const buffer = await fs.readFile(testFile);
const pdfData = await pdf(buffer, { max: 0 });
const text = pdfData.text;

// Find the "Name and address" section
const idx = text.indexOf('Name and address of the Employee');
if (idx > 0) {
  const section = text.slice(idx, idx + 300);
  console.log('Section around "Name and address":');
  console.log(JSON.stringify(section));
  console.log('\nAs visible:');
  console.log(section);
}

// Try the regex
const nameMatch = text.match(/Name and address of the (?:Employee|Specified senior citizen)[\s\n]+([A-Z][A-Za-z\.\s\-&']{2,})(?:\n|Address|LALPANIA|at |PAN)/i);
console.log('\nRegex match:', nameMatch ? nameMatch[1] : 'NO MATCH');

// Try a simpler regex
const simpleMatch = text.match(/Name and address of the Employee[\s\n]+([^\n]+)/i);
console.log('Simple match:', simpleMatch ? simpleMatch[1] : 'NO MATCH');
