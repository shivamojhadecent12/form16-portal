#!/bin/bash

# QUICK TEST: Extract and analyze one sample PDF

echo "═══════════════════════════════════════════════════════════════════"
echo "  SAMPLE PDF ANALYZER - Check what data is in your PDFs"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Find the ZIP file
ZIP_FILE=$(ls -t /Users/shivamojha/Desktop/Test/form16-portal/backend/uploads/imports/*.zip 2>/dev/null | head -1)

if [ -z "$ZIP_FILE" ]; then
  echo "❌ No ZIP files found in uploads/imports/"
  exit 1
fi

echo "📦 Found ZIP: $(basename "$ZIP_FILE")"
echo ""

# Extract first PDF only
TMP_DIR="/tmp/pdf_sample_$$"
mkdir -p "$TMP_DIR"

echo "🔍 Extracting first PDF..."
unzip -q "$ZIP_FILE" "*.pdf" -d "$TMP_DIR" -n 1

FIRST_PDF=$(find "$TMP_DIR" -name "*.pdf" -type f | head -1)

if [ -z "$FIRST_PDF" ]; then
  echo "❌ No PDFs found in ZIP"
  rm -rf "$TMP_DIR"
  exit 1
fi

FILENAME=$(basename "$FIRST_PDF")
echo "📄 Extracted: $FILENAME"
echo ""

# Check if pdftotext is available
if ! command -v pdftotext &> /dev/null; then
  echo "⚠️  pdftotext not installed. Install with:"
  echo "   brew install poppler"
  echo ""
  echo "Trying with Node.js instead..."
  
  # Use Node to extract
  cat > /tmp/extract_pdf_$$.js << 'NODEJS'
const pdf = require('pdf-parse');
const fs = require('fs');

const filePath = process.argv[1];
const pdfBuffer = fs.readFileSync(filePath);

pdf(pdfBuffer).then(data => {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("PDF TEXT CONTENT (first 1500 chars):");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(data.text.substring(0, 1500));
  console.log("...");
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("PATTERN MATCHING:");
  console.log("═══════════════════════════════════════════════════════════════════");
  
  // Test various PAN patterns
  const patterns = {
    'Standard PAN (AAHED1234A)': /([A-Z]{5}[0-9]{4}[A-Z])/i,
    'PAN with spaces': /([A-Z]{5}\s+[0-9]{4}\s+[A-Z])/i,
    'PAN with dashes': /([A-Z]{5}\-[0-9]{4}\-[A-Z])/i,
    'Explicit PAN label': /PAN[\s:]*([A-Z0-9\-\s]+?)(?:\n|$)/i,
  };
  
  for (const [desc, regex] of Object.entries(patterns)) {
    const match = data.text.match(regex);
    console.log(`${desc}: ${match ? '✓ FOUND: ' + match[1] : '✗ NOT FOUND'}`);
  }
  
  // Test name patterns
  console.log("\n--- Name Patterns ---");
  const namePatterns = {
    'Standard "Name:" format': /Name[\s:]*([A-Z][A-Za-z\s\-\.]{3,100})/i,
    '"Employee Name:"': /Employee\s+Name[\s:]*([A-Z][A-Za-z\s\-\.]{3,100})/i,
    'After slash': /\/([A-Z][A-Za-z\s\-\.]{3,100})\//,
    'Between two lines': /\n([A-Z][A-Za-z\s\-\.]{3,100})\n/,
  };
  
  for (const [desc, regex] of Object.entries(namePatterns)) {
    const match = data.text.match(regex);
    console.log(`${desc}: ${match ? '✓ FOUND: ' + match[1].trim() : '✗ NOT FOUND'}`);
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("METADATA:");
  console.log(`Total text length: ${data.text.length} characters`);
  console.log(`Number of pages: ${data.numpages}`);
  
}).catch(err => {
  console.error("Error reading PDF:", err.message);
});
NODEJS

  cd /Users/shivamojha/Desktop/Test/form16-portal/backend
  node /tmp/extract_pdf_$$.js "$FIRST_PDF"
  
else
  # Use pdftotext
  echo "═══════════════════════════════════════════════════════════════════"
  echo "PDF TEXT CONTENT:"
  echo "═══════════════════════════════════════════════════════════════════"
  pdftotext "$FIRST_PDF" - | head -60
  
  echo ""
  echo "═══════════════════════════════════════════════════════════════════"
  echo "ANALYSIS:"
  echo "═══════════════════════════════════════════════════════════════════"
  
  PDF_TEXT=$(pdftotext "$FIRST_PDF" -)
  
  echo "Has PAN pattern 'AAAAA0000A'? $(echo "$PDF_TEXT" | grep -i '[A-Z]\{5\}[0-9]\{4\}[A-Z]' > /dev/null && echo '✓ YES' || echo '✗ NO')"
  echo "Has 'PAN' text? $(echo "$PDF_TEXT" | grep -i 'PAN' > /dev/null && echo '✓ YES' || echo '✗ NO')"
  echo "Has 'Form 16'? $(echo "$PDF_TEXT" | grep -i 'form.*16' > /dev/null && echo '✓ YES' || echo '✗ NO')"
  
  PAN=$(echo "$PDF_TEXT" | grep -oE '[A-Z]{5}[0-9]{4}[A-Z]' | head -1)
  if [ ! -z "$PAN" ]; then
    echo "First PAN found: $PAN"
  fi
fi

# Cleanup
rm -rf "$TMP_DIR"
rm -f /tmp/extract_pdf_$$.js

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "📋 WHAT TO DO NEXT:"
echo ""
echo "1. Look at the output above"
echo "2. Check which PAN pattern was found"
echo "3. Check which name pattern was found"
echo "4. If nothing found, PAN and names might be in different format"
echo ""
echo "5. Send this output to the developer with note:"
echo "   'This is what my PDF contains'"
echo ""
echo "═══════════════════════════════════════════════════════════════════"

