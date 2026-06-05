import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function generateUUID() {
  return crypto.randomUUID();
}

async function setupDatabase() {
  let connection;

  try {
    // Connect without database to create it
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    console.log('📦 Setting up database...');

    // Create database
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'form16_portal'}`);
    console.log('✅ Database created');

    await connection.query(`USE ${process.env.DB_NAME || 'form16_portal'}`);

    // Create tables
    console.log('📋 Creating tables...');

    // Admins table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id CHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Employees table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id CHAR(36) PRIMARY KEY,
        pan VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        name_normalized VARCHAR(255) NOT NULL,
        department VARCHAR(255),
        designation VARCHAR(255),
        employer_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pan (pan),
        INDEX idx_name_normalized (name_normalized)
      )
    `);

    // Employee profiles table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS employee_profiles (
        id CHAR(36) PRIMARY KEY,
        employee_id CHAR(36) UNIQUE NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(255),
        address TEXT,
        date_of_birth DATE,
        joining_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);

    // Documents table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id CHAR(36) PRIMARY KEY,
        employee_id CHAR(36) NOT NULL,
        document_type ENUM('form16', 'salary_slip', 'appointment_letter', 'promotion_letter') NOT NULL,
        financial_year VARCHAR(20) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size BIGINT,
        uploaded_by CHAR(36),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        review_status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
        reviewed_by CHAR(36),
        reviewed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES admins(id),
        FOREIGN KEY (reviewed_by) REFERENCES admins(id),
        INDEX idx_employee_id (employee_id),
        INDEX idx_document_type (document_type),
        INDEX idx_financial_year (financial_year),
        INDEX idx_review_status (review_status),
        INDEX idx_employee_doc_year (employee_id, document_type, financial_year)
      )
    `);

    // Document metadata table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS document_metadata (
        id CHAR(36) PRIMARY KEY,
        document_id CHAR(36) UNIQUE NOT NULL,
        raw_text LONGTEXT,
        parsed_json JSON,
        confidence_score DECIMAL(5,2),
        extraction_errors JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    // AI analysis table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ai_analysis (
        id CHAR(36) PRIMARY KEY,
        document_id CHAR(36) UNIQUE NOT NULL,
        salary_summary JSON,
        tax_summary JSON,
        investment_summary JSON,
        observations JSON,
        employee_explanation TEXT,
        analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    // Chat history table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id CHAR(36) PRIMARY KEY,
        employee_id CHAR(36) NOT NULL,
        document_id CHAR(36),
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        context_used JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        INDEX idx_employee_id (employee_id)
      )
    `);

    // Import jobs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS import_jobs (
        id CHAR(36) PRIMARY KEY,
        document_type ENUM('form16', 'salary_slip', 'appointment_letter', 'promotion_letter') NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        total_files INT DEFAULT 0,
        processed_files INT DEFAULT 0,
        successful_files INT DEFAULT 0,
        failed_files INT DEFAULT 0,
        status ENUM('pending', 'processing', 'completed', 'failed', 'skipped') DEFAULT 'pending',
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        uploaded_by CHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES admins(id),
        INDEX idx_status (status)
      )
    `);

    // Import job logs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS import_job_logs (
        id CHAR(36) PRIMARY KEY,
        import_job_id CHAR(36) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        status ENUM('pending', 'processing', 'completed', 'failed', 'skipped') NOT NULL,
        employee_id CHAR(36),
        document_id CHAR(36),
        error_message TEXT,
        extracted_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (document_id) REFERENCES documents(id),
        INDEX idx_import_job_id (import_job_id)
      )
    `);

    // Audit logs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36),
        user_role ENUM('admin', 'employee') NOT NULL,
        action VARCHAR(255) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id CHAR(36),
        details JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // Settings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id CHAR(36) PRIMARY KEY,
        \`key\` VARCHAR(100) UNIQUE NOT NULL,
        value JSON NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ All tables created');

    // Insert default settings
    console.log('⚙️  Inserting default settings...');
    
    const settings = [
      [generateUUID(), 'openrouter_api_key', '""', 'OpenRouter API Key for AI analysis'],
      [generateUUID(), 'max_file_size_mb', '50', 'Maximum file size for uploads in MB'],
      [generateUUID(), 'allowed_document_types', '["application/pdf"]', 'Allowed document MIME types'],
      [generateUUID(), 'enable_ai_analysis', 'true', 'Enable AI analysis for documents']
    ];

    for (const setting of settings) {
      await connection.query(
        'INSERT IGNORE INTO settings (id, `key`, value, description) VALUES (?, ?, ?, ?)',
        setting
      );
    }

    console.log('✅ Default settings inserted');
    console.log('');
    console.log('🎉 Database setup complete!');
    console.log('');
    console.log('Next step: Run "npm run db:seed" to create default admin user');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase();
