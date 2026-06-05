#!/bin/bash

# Quick diagnostic to understand what's happening

echo "=== Import Jobs Status ==="
mysql -u root -proot123 form16_portal -e "SELECT id, file_name, status, total_files, processed_files, successful_files, failed_files, filter_pans, created_at FROM import_jobs ORDER BY created_at DESC LIMIT 5;"

echo -e "\n=== Recent Employees ==="
mysql -u root -proot123 form16_portal -e "SELECT employee_id, pan, name, COUNT(*) as doc_count FROM documents GROUP BY pan, employee_id, name ORDER BY created_at DESC LIMIT 10;"

echo -e "\n=== Documents Per Employee (Last Import) ==="
mysql -u root -proot123 form16_portal -e "SELECT COUNT(*) as total_docs FROM documents WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);"

echo -e "\n=== Failed Imports ==="
mysql -u root -proot123 form16_portal -e "SELECT import_job_id, COUNT(*) as fail_count, GROUP_CONCAT(DISTINCT error_message LIMIT 5) as errors FROM import_job_logs WHERE status = 'failed' GROUP BY import_job_id ORDER BY created_at DESC LIMIT 3;"

echo -e "\n=== Most Recent Job Details ==="
LATEST_JOB=$(mysql -u root -proot123 form16_portal -e "SELECT id FROM import_jobs ORDER BY created_at DESC LIMIT 1;" | tail -1)
echo "Latest Job ID: $LATEST_JOB"
echo "Job Details:"
mysql -u root -proot123 form16_portal -e "SELECT * FROM import_jobs WHERE id = '$LATEST_JOB';"

