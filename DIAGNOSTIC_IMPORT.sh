#!/bin/bash

# Diagnostic Script - Check Import Results
# This script helps debug why only 2 files were imported

echo "=========================================="
echo "DIAGNOSTIC: Import Job Analysis"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the latest import job
echo -e "${YELLOW}Checking latest import jobs...${NC}"
echo ""
echo "MySQL Query to run:"
echo "USE form16_portal;"
echo "SELECT id, file_name, status, total_files, processed_files, successful_files, failed_files, filter_pans FROM import_jobs ORDER BY created_at DESC LIMIT 5;"
echo ""
echo -e "${YELLOW}To run this:${NC}"
echo "mysql -u root -p form16_portal -e \"SELECT id, file_name, status, total_files, processed_files, successful_files, failed_files, filter_pans FROM import_jobs ORDER BY created_at DESC LIMIT 5;\""
echo ""
echo "=========================================="
echo ""

echo -e "${YELLOW}Checking import job logs (first 20 entries):${NC}"
echo ""
echo "MySQL Query:"
echo "SELECT import_job_id, file_name, status, error_message FROM import_job_logs LIMIT 20;"
echo ""
echo "To run:"
echo "mysql -u root -p form16_portal -e \"SELECT import_job_id, file_name, status, error_message FROM import_job_logs LIMIT 20;\""
echo ""
echo "=========================================="
echo ""

echo -e "${YELLOW}Check documents created:${NC}"
echo ""
echo "MySQL Query:"
echo "SELECT COUNT(*) as total_documents FROM documents;"
echo "SELECT employee_id, COUNT(*) as doc_count FROM documents GROUP BY employee_id;"
echo ""
echo "To run:"
echo "mysql -u root -p form16_portal"
echo "> SELECT COUNT(*) as total_documents FROM documents;"
echo "> SELECT employee_id, COUNT(*) as doc_count FROM documents GROUP BY employee_id;"
echo ""
echo "=========================================="
echo ""

echo -e "${YELLOW}Possible Issues:${NC}"
echo ""
echo "1. ❌ Only 2 files matched the selected PANs"
echo "   → The 2 employees you selected might only have 2 PDFs each"
echo "   → Check: Are they really the right PANs?"
echo ""
echo "2. ❌ PDF extraction failing"
echo "   → Most PDFs failing to parse"
echo "   → Check logs for 'failed' status"
echo ""
echo "3. ❌ Duplicate detection"
echo "   → Documents already exist in DB"
echo "   → Check: error_message = 'Duplicate document'"
echo ""
echo "4. ❌ PAN extraction issues"
echo "   → Can't extract PAN from PDFs"
echo "   → Check: error_message = 'Missing PAN or Employee Name'"
echo ""
echo "=========================================="
echo ""

echo -e "${GREEN}SOLUTION:${NC}"
echo ""
echo "Step 1: Run the MySQL queries above"
echo "Step 2: Look at import_job_logs for ERROR details"
echo "Step 3: Check backend console logs (npm run dev output)"
echo "Step 4: Share the logs so we can debug"
echo ""

