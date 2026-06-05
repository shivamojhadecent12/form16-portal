#!/bin/bash

# DIAGNOSTIC: Check why PDFs aren't being imported when they're from same source

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  SAME-SOURCE PDF IMPORT DIAGNOSTIC                                ║"
echo "║  For PDFs from the same website/format                            ║"
echo "╚════════════════════════════════════════════════════════════════════╝"

echo ""
echo "ℹ️  IMPORTANT: Connect to your MySQL database first"
echo ""
echo "Run these queries to diagnose the issue:"
echo ""

cat << 'SQL'
-- QUERY 1: See what was actually imported
SELECT 
  file_name,
  total_files,
  processed_files,
  successful_files,
  failed_files,
  status,
  created_at
FROM import_jobs
ORDER BY created_at DESC
LIMIT 3;

-- QUERY 2: Check the error messages (most important!)
SELECT 
  COUNT(*) as count,
  error_message,
  GROUP_CONCAT(DISTINCT file_name LIMIT 5) as examples
FROM import_job_logs
WHERE status = 'failed'
GROUP BY error_message
ORDER BY count DESC;

-- QUERY 3: See which files succeeded
SELECT 
  file_name,
  pan,
  employee_name,
  COUNT(*) as doc_count
FROM import_job_logs
WHERE status = 'successful'
GROUP BY pan, employee_name, file_name;

-- QUERY 4: Check duplicate prevention (if files were skipped as duplicates)
SELECT 
  pan,
  employee_name,
  COUNT(*) as total_documents,
  MAX(created_at) as latest
FROM documents
GROUP BY pan, employee_name
ORDER BY total_documents DESC;

SQL

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "📋 WHAT TO DO:"
echo ""
echo "1. Open MySQL:"
echo "   mysql -u root -pYOUR_PASSWORD form16_portal"
echo ""
echo "2. Copy-paste the queries above one by one"
echo ""
echo "3. Share the results with details:"
echo "   - Most common error message?"
echo "   - How many files have 'Could not extract PAN'?"
echo "   - Are there any successful imports?"
echo ""
echo "════════════════════════════════════════════════════════════════════"

