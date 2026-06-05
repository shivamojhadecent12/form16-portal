import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth-mongodb.js';
import employeeRoutes from './routes/employees-mongodb.js';
import documentRoutes from './routes/documents-mongodb.js';
import importRoutes from './routes/import-mongodb.js';
import chatRoutes from './routes/chat-mongodb.js';
import dashboardRoutes from './routes/dashboard.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL || 'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:5173',
      'https://form16-portal.onrender.com',
    ];
    // Allow requests with no origin (e.g. curl, mobile apps)
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/import', importRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 CTC Employee Document Portal - Backend');
  console.log('==========================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('📚 Available routes:');
  console.log('  POST   /api/auth/login/admin');
  console.log('  POST   /api/auth/login/employee');
  console.log('  GET    /api/auth/verify');
  console.log('  GET    /api/employees');
  console.log('  GET    /api/documents');
  console.log('  POST   /api/import/upload');
  console.log('  GET    /api/import/jobs');
  console.log('  POST   /api/chat');
  console.log('  GET    /api/dashboard/stats');
  console.log('');
  console.log('✅ MongoDB configured and ready');
  console.log('');
});

export default app;
