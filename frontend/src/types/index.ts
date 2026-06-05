export type UserRole = 'admin' | 'employee';

export type DocumentType = 'form16' | 'form16_partA' | 'form16_partB' | 'salary_slip' | 'appointment_letter' | 'promotion_letter';

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Admin {
  _id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  _id: string;
  pan: string;
  name: string;
  name_normalized: string;
  department: string | null;
  designation: string | null;
  employer_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeProfile {
  _id: string;
  employee_id: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  date_of_birth: string | null;
  joining_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  _id: string;
  employee_id: string;
  document_type: DocumentType;
  financial_year: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields from the employees table
  employee_name?: string;
  employee_pan?: string;
  employee?: Employee;
}

export interface DocumentMetadata {
  _id: string;
  document_id: string;
  raw_text: string | null;
  parsed_json: Form16Data | null;
  confidence_score: number | null;
  extraction_errors: any | null;
  created_at: string;
  updated_at: string;
}

export interface Form16Data {
  employee_name?: string;
  pan?: string;
  employer_name?: string;
  financial_year?: string;
  assessment_year?: string;
  gross_salary?: number;
  net_salary?: number;
  tds?: number;
  tax_paid?: number;
  deductions?: Record<string, number>;
  investments?: Record<string, number>;
  [key: string]: any;
}

export interface AIAnalysis {
  id: string;
  document_id: string;
  salary_summary: {
    gross_salary: number;
    net_salary: number;
    deductions: number;
    take_home: number;
  } | null;
  tax_summary: {
    total_tax: number;
    tds: number;
    tax_paid: number;
    refund_or_payable: number;
  } | null;
  investment_summary: {
    total_investments: number;
    section_80c: number;
    other_deductions: number;
  } | null;
  observations: string[];
  employee_explanation: string | null;
  analysis_date: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  _id: string;
  employee_id: string;
  document_id: string | null;
  question: string;
  answer: string;
  context_used: any | null;
  created_at: string;
}

export interface ImportJob {
  _id: string;
  document_type: DocumentType;
  file_name: string;
  file_path: string;
  total_files: number;
  processed_files: number;
  successful_files: number;
  failed_files: number;
  status: ImportStatus;
  started_at: string | null;
  completed_at: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportJobLog {
  _id: string;
  import_job_id: string;
  file_name: string;
  status: ImportStatus;
  employee_id: string | null;
  document_id: string | null;
  error_message: string | null;
  extracted_data: any | null;
  created_at: string;
}

export interface AuditLog {
  _id: string;
  user_id: string | null;
  user_role: UserRole;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: any | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: any;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  role: UserRole;
  email?: string;
  name: string;
  pan?: string;
}

export interface LoginCredentials {
  email?: string;
  password?: string;
  pan?: string;
  name?: string;
}

export interface DashboardStats {
  total_employees: number;
  total_documents: number;
  pending_reviews: number;
  active_imports: number;
  form16_partA?: number;
  form16_partB?: number;
}

export interface YearComparison {
  year: string;
  gross_salary: number;
  net_salary: number;
  tax_paid: number;
  tds: number;
}
