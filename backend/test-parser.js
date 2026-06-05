import fs from 'fs/promises';
import pdf from 'pdf-parse';
import { processForm16 } from './src/services/pdfProcessor.js';
import path from 'path';

// Find a sample PDF in uploads/documents
const docsDir = './uploads/documents';

async function main() {
  try {
    console.log('=== Form-16 Parser Diagnostic ===\n');

    // Find all PDFs recursively
    async function findPdfs(dir) {
      const files = [];
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...await findPdfs(fullPath));
          } else if (entry.name.toLowerCase().endsWith('.pdf')) {
            files.push(fullPath);
          }
        }
      } catch (e) {
        // ignore
      }
      return files;
    }

    const pdfFiles = await findPdfs(docsDir);
    console.log(`Found ${pdfFiles.length} PDF files\n`);

    if (pdfFiles.length === 0) {
      console.log('No PDFs found. Please upload a file first.');
      return;
    }

    // Test the first PDF
    const testFile = pdfFiles[0];
    console.log(`Testing: ${testFile}\n`);

    const buffer = await fs.readFile(testFile);
    console.log(`File size: ${buffer.length} bytes\n`);

    // Parse PDF
    console.log('--- Parsing PDF ---');
    const pdfData = await pdf(buffer, { max: 0 });
    console.log(`Pages: ${pdfData.numpages}`);
    console.log(`Text length: ${pdfData.text.length} chars\n`);

    // Show first 500 chars of text
    console.log('--- First 500 chars of extracted text ---');
    console.log(pdfData.text.slice(0, 500));
    console.log('\n--- Last 500 chars of extracted text ---');
    console.log(pdfData.text.slice(-500));

    // Process with Form16 parser
    console.log('\n--- Form-16 Parser Results ---');
    const extracted = processForm16(pdfData.text);
    console.log(JSON.stringify(extracted, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
