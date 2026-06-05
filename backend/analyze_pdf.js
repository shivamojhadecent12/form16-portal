import pdf from 'pdf-parse/lib/pdf-parse.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function analyzePDF() {
  try {
    const zipPath = path.join(__dirname, 'uploads/imports');
    const zipFiles = fs.readdirSync(zipPath).filter(f => f.endsWith('.zip')).sort().reverse();
    
    if (!zipFiles.length) {
      console.log("No ZIP files found in uploads/imports/");
      return;
    }
    
    const zip = zipFiles[0];
    console.log(`📦 ZIP: ${zip}`);
    
    // Extract first PDF
    const tmpDir = '/tmp/pdf_analysis_' + Date.now();
    fs.mkdirSync(tmpDir, { recursive: true });
    
    execSync(`cd "${zipPath}" && unzip -q "${zip}" "*.pdf" -d "${tmpDir}" -n 1 2>/dev/null || true`);
    
    const pdfFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.pdf'));
    
    if (!pdfFiles.length) {
      console.log("No PDFs found in ZIP");
      return;
    }
    
    const pdfFile = path.join(tmpDir, pdfFiles[0]);
    console.log(`📄 PDF: ${pdfFiles[0]}`);
    console.log("");
    
    const pdfBuffer = fs.readFileSync(pdfFile);
    const data = await pdf(pdfBuffer);
    
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║ PDF CONTENT (first 800 characters)                         ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(data.text.substring(0, 800));
    console.log("\n... (truncated, total " + data.text.length + " bytes)\n");
    
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║ PATTERN ANALYSIS                                           ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    
    // Test PAN patterns
    const panPatterns = [
      { name: "Standard (AAAAA0000A)", regex: /([A-Z]{5}[0-9]{4}[A-Z])/i },
      { name: "With spaces", regex: /([A-Z]{5}\s+[0-9]{4}\s+[A-Z])/i },
      { name: "With dashes", regex: /([A-Z]{5}\-[0-9]{4}\-[A-Z])/i },
    ];
    
    console.log("\n🔍 PAN PATTERNS:");
    for (const p of panPatterns) {
      const match = data.text.match(p.regex);
      console.log(`  ${p.name}: ${match ? '✓ ' + match[1] : '✗ NOT FOUND'}`);
    }
    
    // Test name patterns
    const namePatterns = [
      { name: "Name: format", regex: /Name[\s:]*([A-Z][A-Za-z\s\-\.]{3,100})/i },
      { name: "Employee Name:", regex: /Employee\s+Name[\s:]*([A-Z][A-Za-z\s\-\.]{3,100})/i },
      { name: "/NAME/ format", regex: /\/([A-Z][A-Za-z\s\-\.]{3,100})\// },
    ];
    
    console.log("\n👤 NAME PATTERNS:");
    for (const p of namePatterns) {
      const match = data.text.match(p.regex);
      console.log(`  ${p.name}: ${match ? '✓ ' + match[1].trim().substring(0, 50) : '✗ NOT FOUND'}`);
    }
    
    // Try to extract from filename
    console.log("\n📝 FILENAME ANALYSIS:");
    const filename = pdfFiles[0];
    console.log(`  Filename: ${filename}`);
    
    const panFromFilename = filename.match(/([A-Z]{5}[0-9]{4}[A-Z])/i);
    if (panFromFilename) {
      console.log(`  ✓ PAN in filename: ${panFromFilename[1]}`);
    } else {
      console.log(`  ✗ No PAN pattern in filename`);
    }
    
    // Check for underscore-separated parts
    const parts = filename.split('_');
    console.log(`  Filename parts: ${parts.join(' | ')}`);
    
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("✨ KEY FINDINGS:");
    console.log("═══════════════════════════════════════════════════════════");
    
    const panMatch = data.text.match(/([A-Z]{5}[0-9]{4}[A-Z])/i);
    const nameMatch = data.text.match(/Name[\s:]*([A-Z][A-Za-z\s\-\.]{3,100})/i) || 
                      data.text.match(/Employee\s+Name[\s:]*([A-Z][A-Za-z\s\-\.]{3,100})/i);
    
    if (panMatch && nameMatch) {
      console.log("✅ Both PAN and Name can be extracted!");
      console.log(`   PAN: ${panMatch[1]}`);
      console.log(`   Name: ${nameMatch[1].trim()}`);
    } else if (!panMatch) {
      console.log("❌ PAN cannot be extracted with standard patterns");
      console.log("   Possible reasons:");
      console.log("   - Different PAN format");
      console.log("   - PAN not in text (image-based)");
      console.log("   - PAN is encrypted/encoded");
    } else if (!nameMatch) {
      console.log("❌ Name cannot be extracted with standard patterns");
      console.log("   Possible reasons:");
      console.log("   - Different name format");
      console.log("   - Name on different page");
    }
    
    // Cleanup
    execSync(`rm -rf "${tmpDir}"`);
    
  } catch (err) {
    console.error("Error:", err.message);
  }
}

analyzePDF().catch(console.error);

