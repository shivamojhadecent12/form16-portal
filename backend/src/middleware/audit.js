import db from '../services/db.js';
import { generateUUID } from '../utils/uuid.js';

export const auditLog = (action, resourceType) => {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;

    // Override send function
    res.send = function (data) {
      // Log the action
      if (req.user && res.statusCode < 400) {
        const auditLog = {
          _id: generateUUID(),
          user_id: req.user.id || req.user._id,
          user_role: req.user.role,
          action,
          resource_type: resourceType,
          resource_id: req.params.id || null,
          details: { method: req.method, path: req.path },
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          created_at: new Date(),
        };
        db.createAuditLog(auditLog).catch(err => console.error('Audit log error:', err));
      }

      // Call original send
      originalSend.call(this, data);
    };

    next();
  };
};
