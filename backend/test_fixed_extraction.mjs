import { processForm16 } from './src/services/pdfProcessor.js';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import fs from 'fs';

console.log("Testing FIXED PAN extraction...\n");

const pdfPath = '/tmp/pdf_sample/71 BN SSB FORM-16 PART-A & B  25-26/CGHPS7241A_PARTB_2026-27.pdf';
const pdfBuffer = fs.readFileSync(pdfPath);
const data = await pdf(pdfBuffer);
const extracted = processForm16(data.text);

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║ EXTRACTION RESULTS (WITH FIX)                              ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

console.log(`✓ PAN extracted:       ${extracted.pan}`);
console.log(`✓ Name extracted:      ${extracted.employee_name}`);
console.log(`✓ Is Form-16:          ${extracted.is_form16}`);
console.log(`✓ Financial year:      ${extracted.financial_year}\n`);

// Verify correctness
if (extracted.pan === 'CGHPS7241A') {
  console.log("✅ SUCCESS! Extracted EMPLOYEE PAN (not employer)");
} else if (extracted.pan === 'AAALC2348B') {
  console.log("❌ STILL WRONG! Extracted employer PAN instead of employee");
} else {
  console.log(`⚠️  Unexpected PAN: ${extracted.pan}`);
}

if (extracted.employee_name === 'KANCHAN SARKAR') {
  console.log("✅ SUCCESS! Employee name correctly extracted");
} else {
  console.log(`⚠️  Name may need adjustment: ${extracted.employee_name}`);
}
