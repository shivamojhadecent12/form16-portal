import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool = null;

// Create pool lazily on first use
function initPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'form16_portal',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectionTimeout: 10000, // 10 second timeout
      acquireTimeout: 10000,     // 10 second acquire timeout
    });
  }
  return pool;
}

// Proxy object that creates pool on first method call
export default new Proxy({}, {
  get: (target, prop) => {
    const p = initPool();
    return p[prop];
  },
});
