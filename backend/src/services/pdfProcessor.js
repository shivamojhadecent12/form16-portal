// Extract Form-16 data from PDF text
export function processForm16(pdfText) {
  const data = {};

  // Helper: normalize PAN
  function normalizePAN(pan) {
    return pan.replace(/\s|-/g, '').toUpperCase().trim();
  }

  // Flexible PAN regex: accepts with or without spaces/dashes
  const panRegex = /([A-Z]{5}[0-9]{4}[A-Z])|([A-Z]{5}\s*[0-9]{4}\s*[A-Z])/i;
  
  // FIX: Form-16 PDFs contain both Deductor PAN and Employee PAN
  // We need the EMPLOYEE's PAN, not the deductor's (employer)
  // Try multiple patterns for different Form-16 formats
  let panMatch = pdfText.match(/PAN\s+of\s+the\s+Employee[^\n]*\n\s*([A-Z]{5}[0-9]{4}[A-Z])/i);
  
  // Fallback: Look for "PAN of the Employee/Specified senior citizen" format
  if (!panMatch) {
    panMatch = pdfText.match(/PAN\s+of\s+the\s+Employee.*?Specified[^\n]*\n\s*([A-Z]{5}[0-9]{4}[A-Z])/i);
  }
  
  // Fallback: Look for "Employee" or "Assessee" PAN (common variations)
  if (!panMatch) {
    panMatch = pdfText.match(/(?:Employee|Assessee|Individual)\s+PAN[^\n]*\n\s*([A-Z]{5}[0-9]{4}[A-Z])/i);
  }
  
  // Fallback: if Employee PAN pattern not found, use first PAN
  if (!panMatch) {
    panMatch = pdfText.match(panRegex);
  }
  
  if (panMatch) {
    // Extract from captured group (group 1) or whole match
    const extractedPAN = panMatch[1] || panMatch[0];
    data.pan = normalizePAN(extractedPAN);
  }

  // Mark presence of "Form 16" to help detection (also matches "FORM NO. 16")
  data.is_form16 = /form\s*(?:no\.?)?\s*16/i.test(pdfText) || false;

  // Try to extract name using common labels
  // First try: "Name and address of the Employee" format (common in Form-16, with "/" delimiter)
  let nameMatch = pdfText.match(/Name and address of the Employee.*?\n([A-Z][A-Za-z\.\s\-&']+?)(?:\n|$)/i);
  
  // Second try: standard "Name:" format
  if (!nameMatch) {
    nameMatch = pdfText.match(/^[\s\n]*(?:Name|Employee Name|Assessee Name|Taxpayer Name)[\s:]+([A-Z][A-Za-z\.\s\-&']{2,})(?:\n|PAN|Address|$)/im);
  }
  
  // Third try: Look after "PAN of the Employee" - sometimes name appears right after PAN
  if (!nameMatch && panMatch) {
    const panIndex = pdfText.indexOf(panMatch[0]);
    if (panIndex !== -1) {
      const afterPan = pdfText.substring(panIndex + panMatch[0].length, panIndex + 500);
      const nameAfterPan = afterPan.match(/([A-Z][A-Za-z\s\-&'\.]{2,})/);
      if (nameAfterPan && !nameAfterPan[1].match(/PAN|Address|Date|Year|INR/i)) {
        nameMatch = nameAfterPan;
      }
    }
  }
  
  if (nameMatch) {
    data.employee_name = nameMatch[1].trim();
  }

  // If name not found, look for a name near the PAN (previous 1-3 lines)
  if (!data.employee_name && panMatch) {
    const lines = pdfText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const panLineIndex = lines.findIndex(l => l.match(panRegex));
    if (panLineIndex > 0) {
      // search up to 3 lines above and 1 line below for a plausible name
      const start = Math.max(0, panLineIndex - 3);
      const end = Math.min(lines.length - 1, panLineIndex + 1);
      // prefer multi-word candidates (likely full names)
      for (let i = start; i <= end; i++) {
        const candidate = lines[i];
        if (!candidate) continue;
        // skip lines that look like PAN or addresses (contain digits mostly)
        if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(candidate.replace(/\s|-/g, ''))) continue;
        // prefer multi-word (contains space) and letters only
        if (/^[A-Za-z\s'\.\-&]{3,120}$/.test(candidate) && candidate.includes(' ')) {
          data.employee_name = candidate.trim();
          break;
        }
      }
      // fallback: accept single-word candidate if none found above
      if (!data.employee_name) {
        for (let i = start; i < panLineIndex; i++) {
          const candidate = lines[i];
          if (/^[A-Za-z\s'\.\-&]{3,80}$/.test(candidate)) {
            data.employee_name = candidate.trim();
            break;
          }
        }
      }
    }
  }

  // Employer name
  const employerMatch = pdfText.match(/(?:Employer Name|Name of Employer|Deductor Name)[\s:]+([A-Za-z\.&'\-\s]+?)(?:\n|Address|PAN)/i);
  if (employerMatch) {
    data.employer_name = employerMatch[1].trim();
  }

  // Financial year / assessment year
  // PRIORITY 1: Look for "Assessment Year" field specifically in the form table
  // This is typically in a table cell with the label on left and value on right
  const ayTableMatch = pdfText.match(/(?:Assessment Year|A\.Y\.)\s*[\n\t]?\s*(\d{4}[-\/]\d{2})/i);
  if (ayTableMatch) {
    data.assessment_year = ayTableMatch[1];
  }
  
  // PRIORITY 2: Look for "Period with the Employer" section which shows dates
  // Extract just the FROM date in YYYY-YY format
  if (!data.assessment_year) {
    const periodMatch = pdfText.match(/Period[:\s\n]+(?:From|FROM)\s*[\n\t]?\s*(\d{1,2})[-\/]([A-Za-z]{3})-?(\d{4})/i);
    if (periodMatch) {
      // Convert "01-Apr-2025" to "2025-26" based on date
      const month = periodMatch[2];
      const year = parseInt(periodMatch[3]);
      // If month is Apr-Dec, it's YYYY-YY. If Jan-Mar, it's YYYY-(YY-1)
      const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
      if (monthNum >= 4) {
        data.assessment_year = `${year}-${(year + 1).toString().slice(-2)}`;
      } else {
        data.assessment_year = `${year - 1}-${year.toString().slice(-2)}`;
      }
    }
  }
  
  // PRIORITY 3: Look for financial year pattern
  if (!data.assessment_year) {
    const fyMatch = pdfText.match(/(?:Financial Year|F\.Y\.|Financial Year:)[\s\n:]*(\d{4}[-\/]\d{2,4})/i);
    if (fyMatch) {
      data.assessment_year = fyMatch[1];
    }
  }
  
  // PRIORITY 4: Find FIRST occurrence of YYYY-YY pattern (should be in Assessment Year field area)
  if (!data.assessment_year) {
    const fyPattern = pdfText.match(/\b(20\d{2}[-\/]\d{2})\b/);
    if (fyPattern) {
      data.assessment_year = fyPattern[1];
    }
  }
  
  // Always set financial_year to assessment_year for consistency
  data.financial_year = data.assessment_year;

  // SMARTER APPROACH: Look for the salary SUMMARY TABLE in Form 16
  // Form 16 Part A contains a table with quarterly data like:
  // Q1, Q2, Q3, Q4 amounts and TOTAL row
  
  // Strategy: Find lines with quarterly data and extract the TOTAL amount
  const lines = pdfText.split('\n');
  let totalAmountPaid = undefined;
  let quarterlyAmounts = [];
  
  // Look for Total row in the summary section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for patterns like "Total (Rs.)0.000.00254435.00"
    // or lines with Q1, Q2, Q3, Q4 data
    if (line.match(/Total\s*\(Rs\.\)/i)) {
      // Extract all numbers from this line
      const nums = line.match(/\d+(?:\.\d+)?/g) || [];
      if (nums.length >= 2) {
        // Last number is usually the total amount paid
        totalAmountPaid = parseFloat(nums[nums.length - 1]);
      }
    }
    
    // Also look for quarterly patterns: Q1, Q2, Q3, Q4
    if (line.match(/\bQ[1-4]\b/i)) {
      const nums = line.match(/(\d+(?:,\d+)*(?:\.\d+)?)/g) || [];
      nums.forEach(n => {
        const amount = parseFloat(n.replace(/,/g, ''));
        if (amount >= 50000 && amount <= 2000000) {
          quarterlyAmounts.push(amount);
        }
      });
    }
  }
  
  // Use total if found
  if (totalAmountPaid && totalAmountPaid >= 100000 && totalAmountPaid <= 5000000) {
    data.gross_salary = totalAmountPaid;
  }
  
  // If we found quarterly amounts but no total, sum them
  if (!data.gross_salary && quarterlyAmounts.length > 0) {
    const sum = quarterlyAmounts.reduce((a, b) => a + b, 0);
    if (sum >= 100000 && sum <= 5000000) {
      data.gross_salary = sum;
    }
  }
  
  // TDS and Tax - look for pattern "Amount of tax deducted"
  let tdsMatch = pdfText.match(/(?:Amount of tax deducted|TDS Deducted|Total TDS)[\s\n:]*(?:Rs\.?)?[\s]*([0-9,\.]+)/i);
  data.tds = tdsMatch ? parseFloat(tdsMatch[1].replace(/,/g, '')) : undefined;

  let taxMatch = pdfText.match(/(?:Tax Paid|Net Tax Payable|Total Tax)[\s\n:]*(?:Rs\.?)?[\s]*([0-9,\.]+)/i);
  data.tax_paid = taxMatch ? parseFloat(taxMatch[1].replace(/,/g, '')) : undefined;

  // Validate extracted values
  if (data.gross_salary && (data.gross_salary < 100000 || data.gross_salary > 5000000)) {
    data.gross_salary = undefined;
  }
  if (data.tds && (data.tds < 0 || data.tds > 2000000)) {
    data.tds = undefined;
  }
  if (data.tax_paid && (data.tax_paid < 0 || data.tax_paid > 2000000)) {
    data.tax_paid = undefined;
  }

  // Deductions and investments
  data.deductions = {};
  const deduction80CMatch = pdfText.match(/(?:80C|Section 80C)[\s:Rs.]*([0-9,]+(?:\.\d+)?)/i);
  if (deduction80CMatch) data.deductions['80C'] = parseFloat(deduction80CMatch[1].replace(/,/g, ''));
  const deduction80DMatch = pdfText.match(/(?:80D|Section 80D)[\s:Rs.]*([0-9,]+(?:\.\d+)?)/i);
  if (deduction80DMatch) data.deductions['80D'] = parseFloat(deduction80DMatch[1].replace(/,/g, ''));

  data.investments = {};
  const ppfMatch = pdfText.match(/(?:PPF|Public Provident Fund)[\s:Rs.]*([0-9,]+(?:\.\d+)?)/i);
  if (ppfMatch) data.investments.ppf = parseFloat(ppfMatch[1].replace(/,/g, ''));
  const lifeInsuranceMatch = pdfText.match(/(?:Life Insurance|LIC)[\s:Rs.]*([0-9,]+(?:\.\d+)?)/i);
  if (lifeInsuranceMatch) data.investments.life_insurance = parseFloat(lifeInsuranceMatch[1].replace(/,/g, ''));

  // Detect Part A or Part B from PDF content
  // Check for Part B first (more specific), then Part A, to avoid false positives
  // Look for patterns like "PART B", "Part B", "PART-B", "Schedule B"
  // Better Form16 Part Detection

const firstPageText = pdfText.substring(0, 5000);

// Filename-independent detection using strong identifiers

const isPartA =
  /FORM\s+NO\.?\s*16/i.test(firstPageText) &&
  (
    /Certificate under section 203/i.test(firstPageText) ||
    /PART\s*A/i.test(firstPageText) ||
    /Name and address of the Employer/i.test(firstPageText) ||
    /PAN of the Deductor/i.test(firstPageText)
  );

const isPartB =
  /PART\s*B/i.test(firstPageText) ||
  /Details of Salary Paid/i.test(firstPageText) ||
  /Income chargeable under the head/i.test(firstPageText) ||
  /Deduction under Chapter VI-A/i.test(firstPageText) ||
  /Relief under section 89/i.test(firstPageText);

if (isPartA && !isPartB) {
  data.form_part = 'partA';
} else if (isPartB && !isPartA) {
  data.form_part = 'partB';
} else if (isPartA && isPartB) {
  // Prefer filename hint if available later
  data.form_part = 'unknown';
} else {
  data.form_part = 'unknown';
}

  return data;
}
