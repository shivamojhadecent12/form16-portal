import pdf from 'pdf-parse/lib/pdf-parse.js';
import fs from 'fs';

const pdfPath = '/tmp/pdf_sample/71 BN SSB FORM-16 PART-A & B  25-26/CGHPS7241A_PARTB_2026-27.pdf';
const pdfBuffer = fs.readFileSync(pdfPath);

const data = await pdf(pdfBuffer);

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║ PDF ANALYSIS RESULTS                                       ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log("\n📄 File: CGHPS7241A_PARTB_2026-27.pdf");
console.log(`Pages: ${data.numpages}`);
console.log(`Text length: ${data.text.length} bytes\n`);

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║ FIRST 1000 CHARACTERS                                      ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log(data.text.substring(0, 1000));
console.log("\n... (truncated)\n");

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║ PATTERN MATCHING                                           ║");
console.log("╚════════════════════════════════════════════════════════════╝");

// PAN patterns
const panTests = [
  { name: "Standard (AAAAA0000A)", regex: /([A-Z]{5}[0-9]{4}[A-Z])/i },
  { name: "With spaces", regex: /([A-Z]{5}\s+[0-9]{4}\s+[A-Z])/i },
  { name: "With dashes", regex: /([A-Z]{5}\-[0-9]{4}\-[A-Z])/i },
  { name: "From filename", regex: /CGHPS7241A/ },
];

console.log("\n🔍 PAN PATTERNS:");
for (const test of panTests) {
  const match = data.text.match(test.regex) || (test.name === "From filename" && test.regex.test(pdfPath));
  console.log(`  ${test.name}: ${match ? '✓ FOUND' : '✗ NOT FOUND'}`);
}

// Name patterns
const nameTests = [
  { name: "Name: XXX", regex: /Name[\s:]*([A-Z][A-Za-z\s\-\.]{3,100})/i },
  { name: "Employee Name: XXX", regex: /Employee\s+Name[\s:]*([A-Z][A-Za-z\s\-\.]{3,100})/i },
  { name: "/XXX/ format", regex: /\/([A-Z][A-Za-z\s\-\.]{3,100})\// },
  { name: "PAN.*Name pattern", regex: /PAN.*?\n.*?\n.*?([A-Z][A-Za-z\s\-\.]{3,50})/i },
];

console.log("\n👤 NAME PATTERNS:");
for (const test of nameTests) {
  const match = data.text.match(test.regex);
  if (match) {
    console.log(`  ${test.name}: ✓ FOUND - "${match[1].trim().substring(0, 50)}"`);
  } else {
    console.log(`  ${test.name}: ✗ NOT FOUND`);
  }
}

// Check what the current extraction logic would find
console.log("\n═══════════════════════════════════════════════════════════");
console.log("✨ CURRENT EXTRACTION RESULT");
console.log("═══════════════════════════════════════════════════════════");

const panMatch = data.text.match(/([A-Z]{5}[0-9]{4}[A-Z])/i);
const nameMatch = data.text.match(/Name and address of the Employee.*?\n([A-Z][A-Za-z\.\s\-&']+?)(?:\n|$)/i) ||
                  data.text.match(/^[\s\n]*(?:Name|Employee Name|Assessee Name|Taxpayer Name)[\s:]+([A-Z][A-Za-z\.\s\-&']{2,})(?:\n|PAN|Address|$)/im);

console.log(`PAN extraction: ${panMatch ? '✓ ' + panMatch[1] : '✗ FAILED'}`);
console.log(`Name extraction: ${nameMatch ? '✓ ' + nameMatch[1].trim() : '✗ FAILED'}`);

if (!panMatch && !nameMatch) {
  console.log("\n⚠️  PROBLEM: Both PAN and Name extraction failed!");
} else if (!panMatch) {
  console.log("\n⚠️  PROBLEM: PAN extraction failed!");
} else if (!nameMatch) {
  console.log("\n⚠️  PROBLEM: Name extraction failed!");
  console.log("\nThe filename contains the PAN: CGHPS7241A");
  console.log("But the name couldn't be extracted from the PDF text.");
} else {
  console.log("\n✅ SUCCESS: Both PAN and Name can be extracted!");
}

