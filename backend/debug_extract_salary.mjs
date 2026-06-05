import pdfParse from 'pdf-parse';
import fs from 'fs';
import yauzl from 'yauzl';

const zipPath = '/Users/shivamojha/Desktop/Test/form16-portal/backend/uploads/imports/1780637405040_Archive.zip';

yauzl.open(zipPath, { lazyEntries: true }, async (err, zipfile) => {
  if (err) throw err;
  
  zipfile.readEntry();
  let count = 0;
  
  zipfile.on('entry', async (entry) => {
    if (entry.filename.endsWith('.pdf') && count === 0) {
      count++;
      zipfile.openReadStream(entry, (err, stream) => {
        if (err) throw err;
        
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', async () => {
          const buffer = Buffer.concat(chunks);
          const data = await pdfParse(buffer);
          const text = data.text;
          
          console.log('=== PDF TEXT (First 3000 chars) ===');
          console.log(text.substring(0, 3000));
          console.log('\n=== LOOKING FOR SALARY PATTERNS ===');
          
          // Look for any numbers that might be salaries
          const bigNumbers = text.match(/\d{5,10}/g) || [];
          console.log('Big numbers found:', [...new Set(bigNumbers)].slice(0, 10));
          
          // Look for salary keywords
          const salarySection = text.match(/(?:Salary|Gross|Net|Income)[\s\S]{0,500}/gi);
          if (salarySection) {
            console.log('\n=== SALARY KEYWORDS ===');
            salarySection.slice(0, 3).forEach(s => console.log(s.substring(0, 200)));
          }
          
          process.exit(0);
        });
      });
    } else {
      zipfile.readEntry();
    }
  });
});
