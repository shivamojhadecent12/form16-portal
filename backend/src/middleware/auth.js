import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  let token;
  
  // Try Authorization header first (Bearer token)
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    token = authHeader.split(' ')[1];
  }
  
  // Fallback to query parameter (for iframe/direct links)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const requireEmployee = (req, res, next) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ error: 'Employee access required' });
  }
  next();
};

export const checkOwnership = (req, res, next) => {
  // For employees, ensure they can only access their own data
  if (req.user.role === 'employee') {
    req.employeeId = req.user.id;
  }
  next();
};
