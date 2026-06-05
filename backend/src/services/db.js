/**
 * MongoDB Database Access Layer
 * Provides simplified database operations for all routes
 */

import { getCollection, Collections } from '../config/mongodb.js';
import { ObjectId } from 'mongodb';

// Helper to convert MongoDB _id to string id format
function toId(mongoId) {
  if (mongoId instanceof ObjectId) {
    return mongoId.toString();
  }
  return mongoId;
}

function toMongoId(id) {
  if (typeof id === 'string' && id.length === 24) {
    try {
      return new ObjectId(id);
    } catch (e) {
      return id;
    }
  }
  return id;
}

// Admins
export async function getAdmin(email) {
  const collection = await getCollection(Collections.ADMINS);
  return await collection.findOne({ email });
}

export async function getAdminById(id) {
  const collection = await getCollection(Collections.ADMINS);
  return await collection.findOne({ _id: id });
}

export async function createAdmin(admin) {
  const collection = await getCollection(Collections.ADMINS);
  return await collection.insertOne(admin);
}

// Employees
export async function getEmployee(pan) {
  const collection = await getCollection(Collections.EMPLOYEES);
  return await collection.findOne({ pan });
}

export async function getEmployeeById(id) {
  const collection = await getCollection(Collections.EMPLOYEES);
  return await collection.findOne({ _id: id });
}

export async function getAllEmployees(skip = 0, limit = 10000) {
  const collection = await getCollection(Collections.EMPLOYEES);
  return await collection.find({}).skip(skip).limit(limit).toArray();
}

export async function createEmployee(employee) {
  const collection = await getCollection(Collections.EMPLOYEES);
  return await collection.insertOne(employee);
}

export async function updateEmployee(id, updates) {
  const collection = await getCollection(Collections.EMPLOYEES);
  return await collection.updateOne({ _id: id }, { $set: updates });
}

export async function deleteEmployee(id) {
  const collection = await getCollection(Collections.EMPLOYEES);
  return await collection.deleteOne({ _id: id });
}

// Employee Profiles
export async function getEmployeeProfile(employeeId) {
  const collection = await getCollection(Collections.EMPLOYEE_PROFILES);
  // Convert ObjectId to string for comparison
  const employeeIdStr = typeof employeeId === 'string' ? employeeId : employeeId.toString();
  return await collection.findOne({ employee_id: employeeIdStr });
}

export async function createEmployeeProfile(profile) {
  const collection = await getCollection(Collections.EMPLOYEE_PROFILES);
  return await collection.insertOne(profile);
}

export async function updateEmployeeProfile(employeeId, updates) {
  const collection = await getCollection(Collections.EMPLOYEE_PROFILES);
  return await collection.updateOne({ employee_id: employeeId }, { $set: updates });
}

// Documents
export async function getDocument(id) {
  const collection = await getCollection(Collections.DOCUMENTS);
  return await collection.findOne({ _id: id });
}

export async function getDocumentsByEmployee(employeeId, documentType = null) {
  const collection = await getCollection(Collections.DOCUMENTS);
  // Convert ObjectId to string for comparison (documents store employee_id as string)
  const employeeIdStr = typeof employeeId === 'string' ? employeeId : employeeId.toString();
  const query = { employee_id: employeeIdStr };
  if (documentType) {
    query.document_type = documentType;
  }
  return await collection.find(query).toArray();
}

export async function getDocumentsByYear(employeeId, year) {
  const collection = await getCollection(Collections.DOCUMENTS);
  // Convert ObjectId to string for comparison
  const employeeIdStr = typeof employeeId === 'string' ? employeeId : employeeId.toString();
  return await collection.find({
    employee_id: employeeIdStr,
    financial_year: year,
  }).toArray();
}

export async function getAllDocuments(skip = 0, limit = 10000, filters = {}) {
  const collection = await getCollection(Collections.DOCUMENTS);
  return await collection.find(filters).skip(skip).limit(limit).toArray();
}

export async function createDocument(document) {
  const collection = await getCollection(Collections.DOCUMENTS);
  return await collection.insertOne(document);
}

export async function updateDocument(id, updates) {
  const collection = await getCollection(Collections.DOCUMENTS);
  return await collection.updateOne({ _id: id }, { $set: updates });
}

export async function deleteDocument(id) {
  const collection = await getCollection(Collections.DOCUMENTS);
  return await collection.deleteOne({ _id: id });
}

export async function checkDuplicateDocument(employeeId, documentType, financialYear) {
  const collection = await getCollection(Collections.DOCUMENTS);
  return await collection.findOne({
    employee_id: employeeId,
    document_type: documentType,
    financial_year: financialYear,
  });
}

// Document Metadata
export async function getDocumentMetadata(documentId) {
  const collection = await getCollection(Collections.DOCUMENT_METADATA);
  return await collection.findOne({ document_id: documentId });
}

export async function createDocumentMetadata(metadata) {
  const collection = await getCollection(Collections.DOCUMENT_METADATA);
  return await collection.insertOne(metadata);
}

export async function updateDocumentMetadata(documentId, updates) {
  const collection = await getCollection(Collections.DOCUMENT_METADATA);
  return await collection.updateOne({ document_id: documentId }, { $set: updates });
}

// AI Analysis
export async function getAIAnalysis(documentId) {
  const collection = await getCollection(Collections.AI_ANALYSIS);
  return await collection.findOne({ document_id: documentId });
}

export async function createAIAnalysis(analysis) {
  const collection = await getCollection(Collections.AI_ANALYSIS);
  return await collection.insertOne(analysis);
}

export async function updateAIAnalysis(documentId, updates) {
  const collection = await getCollection(Collections.AI_ANALYSIS);
  return await collection.updateOne({ document_id: documentId }, { $set: updates });
}

// Chat History
export async function getChatHistory(employeeId, documentId = null) {
  const collection = await getCollection(Collections.CHAT_HISTORY);
  // Convert ObjectId to string for comparison
  const employeeIdStr = typeof employeeId === 'string' ? employeeId : employeeId.toString();
  const query = { employee_id: employeeIdStr };
  if (documentId) {
    query.document_id = documentId;
  }
  return await collection.find(query).sort({ created_at: -1 }).toArray();
}

export async function createChatMessage(message) {
  const collection = await getCollection(Collections.CHAT_HISTORY);
  return await collection.insertOne(message);
}

export async function deleteChatHistory(employeeId, documentId = null) {
  const collection = await getCollection(Collections.CHAT_HISTORY);
  // Convert ObjectId to string for comparison
  const employeeIdStr = typeof employeeId === 'string' ? employeeId : employeeId.toString();
  const query = { employee_id: employeeIdStr };
  if (documentId) {
    query.document_id = documentId;
  }
  return await collection.deleteMany(query);
}

// Import Jobs
export async function getImportJob(id) {
  const collection = await getCollection(Collections.IMPORT_JOBS);
  return await collection.findOne({ _id: id });
}

export async function getImportJobs(skip = 0, limit = 50) {
  const collection = await getCollection(Collections.IMPORT_JOBS);
  return await collection.find({}).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();
}

export async function createImportJob(job) {
  const collection = await getCollection(Collections.IMPORT_JOBS);
  return await collection.insertOne(job);
}

export async function updateImportJob(id, updates) {
  const collection = await getCollection(Collections.IMPORT_JOBS);
  return await collection.updateOne({ _id: id }, { $set: updates });
}

// Import Job Logs
export async function getImportJobLogs(importJobId) {
  const collection = await getCollection(Collections.IMPORT_JOB_LOGS);
  return await collection.find({ import_job_id: importJobId }).toArray();
}

export async function createImportJobLog(log) {
  const collection = await getCollection(Collections.IMPORT_JOB_LOGS);
  return await collection.insertOne(log);
}

// Audit Logs
export async function createAuditLog(log) {
  const collection = await getCollection(Collections.AUDIT_LOGS);
  return await collection.insertOne(log);
}

export async function getAuditLogs(skip = 0, limit = 50, filters = {}) {
  const collection = await getCollection(Collections.AUDIT_LOGS);
  return await collection.find(filters).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();
}

// Settings
export async function getSetting(key) {
  const collection = await getCollection(Collections.SETTINGS);
  return await collection.findOne({ key });
}

export async function getAllSettings() {
  const collection = await getCollection(Collections.SETTINGS);
  return await collection.find({}).toArray();
}

export async function updateSetting(key, value) {
  const collection = await getCollection(Collections.SETTINGS);
  return await collection.updateOne(
    { key },
    { $set: { value, updated_at: new Date() } },
    { upsert: true }
  );
}

// Aggregation Queries
export async function getDashboardStats() {
  const collection = await getCollection(Collections.DOCUMENTS);
  const stats = await collection.aggregate([
    {
      $group: {
        _id: null,
        total_documents: { $sum: 1 },
        total_files_size: { $sum: '$file_size' },
      },
    },
  ]).toArray();
  
  return stats[0] || { total_documents: 0, total_files_size: 0 };
}

export async function getDocumentsByYearAndType(employeeId) {
  const collection = await getCollection(Collections.DOCUMENTS);
  // Convert ObjectId to string for comparison
  const employeeIdStr = typeof employeeId === 'string' ? employeeId : employeeId.toString();
  return await collection.aggregate([
    {
      $match: { employee_id: employeeIdStr },
    },
    {
      $group: {
        _id: {
          year: '$financial_year',
          type: '$document_type',
        },
        count: { $sum: 1 },
        documents: { $push: '$$ROOT' },
      },
    },
    {
      $sort: { '_id.year': -1 },
    },
  ]).toArray();
}

export default {
  // Admins
  getAdmin,
  getAdminById,
  createAdmin,
  
  // Employees
  getEmployee,
  getEmployeeById,
  getAllEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  
  // Employee Profiles
  getEmployeeProfile,
  createEmployeeProfile,
  updateEmployeeProfile,
  
  // Documents
  getDocument,
  getDocumentsByEmployee,
  getDocumentsByYear,
  getAllDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  checkDuplicateDocument,
  
  // Document Metadata
  getDocumentMetadata,
  createDocumentMetadata,
  updateDocumentMetadata,
  
  // AI Analysis
  getAIAnalysis,
  createAIAnalysis,
  updateAIAnalysis,
  
  // Chat History
  getChatHistory,
  createChatMessage,
  deleteChatHistory,
  
  // Import Jobs
  getImportJob,
  getImportJobs,
  createImportJob,
  updateImportJob,
  
  // Import Job Logs
  getImportJobLogs,
  createImportJobLog,
  
  // Audit Logs
  createAuditLog,
  getAuditLogs,
  
  // Settings
  getSetting,
  getAllSettings,
  updateSetting,
  
  // Aggregations
  getDashboardStats,
  getDocumentsByYearAndType,
};
