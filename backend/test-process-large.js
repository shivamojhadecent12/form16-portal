import yauzl from 'yauzl';
import fs from 'fs/promises';

async function extractPDFsFromZip(zipPath, jobId = 'test') {
  return new Promise((resolve, reject) => {
    const pdfFiles = [];

    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        return reject(new Error(`Failed to open ZIP: ${err.message}`));
      }

      let entryCount = 0;
      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        entryCount++;

        // Skip directories and macOS metadata
        if (entry.fileName.endsWith('/') || entry.fileName.includes('__MACOSX') || entry.fileName.startsWith('._')) {
          console.log(`  [Skipped] ${entry.fileName}`);
          zipfile.readEntry();
          return;
        }

        // Process PDF files
        if (entry.fileName.toLowerCase().endsWith('.pdf')) {
          console.log(`  [PDF] ${entry.fileName} (${entry.uncompressedSize} bytes)`);
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error(`Failed to read entry ${entry.fileName}:`, err.message);
              zipfile.readEntry();
              return;
            }

            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              const buffer = Buffer.concat(chunks);
              pdfFiles.push({
                entryName: entry.fileName,
                getData: () => buffer,
              });
              zipfile.readEntry();
            });
            readStream.on('error', (err) => {
              console.error(`Stream error for ${entry.fileName}:`, err.message);
              zipfile.readEntry();
            });
          });
        } else {
          console.log(`  [Other] ${entry.fileName}`);
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        console.log(`ZIP extraction complete: ${entryCount} entries, ${pdfFiles.length} PDFs found`);
        resolve(pdfFiles);
      });

      zipfile.on('error', (err) => {
        reject(new Error(`ZIP reading error: ${err.message}`));
      });
    });
  });
}

async function test() {
  try {
    const zipPath = '/Users/shivamojha/Desktop/Test/form16-portal/backend/uploads/imports/1780237585841_FORM-16 PART-A & B  25-26.zip';
    
    console.log('Testing large ZIP extraction with yauzl...');
    console.log('File:', zipPath);
    console.log('');

    const stats = await fs.stat(zipPath);
    console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);

    console.log('Extracting PDFs from ZIP...');
    const startTime = Date.now();
    const pdfs = await extractPDFsFromZip(zipPath);
    const elapsed = Date.now() - startTime;

    console.log(`\n✅ Success! Extracted in ${elapsed}ms`);
    console.log(`PDFs extracted: ${pdfs.length}`);
    pdfs.forEach((pdf, idx) => {
      const buffer = pdf.getData();
      console.log(`  ${idx + 1}. ${pdf.entryName} (${buffer.length} bytes)`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

test();
