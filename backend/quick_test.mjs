import pdfParse from 'pdf-parse';
import yauzl from 'yauzl';

yauzl.open('/Users/shivamojha/Desktop/Test/form16-portal/backend/uploads/imports/1780637405040_Archive.zip', { lazyEntries: true }, (err, zf) => {
  if (err) throw err;
  zf.readEntry();
  zf.on('entry', (entry) => {
    if (entry.filename.endsWith('2025-26_fake.pdf')) {
      zf.openReadStream(entry, async (err, stream) => {
        const chunks = [];
        stream.on('data', c => chunks.push(c));
        stream.on('end', async () => {
          const data = await pdfParse(Buffer.concat(chunks));
          const t = data.text;
          console.log(t.substring(t.indexOf('Salary'), t.indexOf('Salary') + 300));
          process.exit(0);
        });
      });
    } else zf.readEntry();
  });
});
