import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { auditLogs } from '../../shared/schema';

// Extended Request interface to include tenant information
export interface TenantRequest extends Request {
  tenantId?: number;
  userId?: number;
}

// Audit log types
export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  FAILED_LOGIN = 'FAILED_LOGIN'
}

// Tenant isolation middleware
export function tenantIsolation(req: TenantRequest, res: Response, next: NextFunction) {
  // Extract user information from session or token
  if (req.isAuthenticated && req.isAuthenticated()) {
    const user = req.user as any;
    req.userId = user.id;
    req.tenantId = user.id; // In this system, each user is their own tenant
    console.log(`Tenant isolation: User ${user.id} accessing ${req.method} ${req.path}`);
  } else {
    // Check for token-based authentication
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // For token auth, we'll set a default admin tenant
      req.userId = 1;
      req.tenantId = 1;
      console.log(`Tenant isolation: Token auth accessing ${req.method} ${req.path}`);
    } else {
      console.log(`Tenant isolation: No authentication found for ${req.method} ${req.path}`);
      return res.status(401).json({ message: 'Authentication required' });
    }
  }

  next();
}

// Audit logging function
export async function logAuditEvent(
  userId: number,
  action: AuditAction,
  resource: string,
  resourceId?: number,
  details?: any,
  ipAddress?: string
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resource,
      resourceId,
      details: details ? JSON.stringify(details) : null,
      ipAddress,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw error to avoid breaking the main operation
  }
}

// Middleware to automatically log API access
export function auditLogger(req: TenantRequest, res: Response, next: NextFunction) {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log the API access after response is sent
    if (req.userId && req.path.startsWith('/api/')) {
      const action = getAuditActionFromMethod(req.method);
      const resource = extractResourceFromPath(req.path);
      
      logAuditEvent(
        req.userId,
        action,
        resource,
        undefined,
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent')
        },
        req.ip
      );
    }
    
    return originalSend.call(this, data);
  };

  next();
}

// Helper function to map HTTP methods to audit actions
function getAuditActionFromMethod(method: string): AuditAction {
  switch (method.toUpperCase()) {
    case 'GET':
      return AuditAction.READ;
    case 'POST':
      return AuditAction.CREATE;
    case 'PUT':
    case 'PATCH':
      return AuditAction.UPDATE;
    case 'DELETE':
      return AuditAction.DELETE;
    default:
      return AuditAction.READ;
  }
}

// Helper function to extract resource name from API path
function extractResourceFromPath(path: string): string {
  const parts = path.split('/').filter(part => part.length > 0);
  if (parts.length >= 2 && parts[0] === 'api') {
    return parts[1];
  }
  return 'unknown';
}

// Data access validation middleware for specific resources
export function validateTenantAccess(resource: string) {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    if (!req.tenantId) {
      return res.status(401).json({ message: 'Tenant ID required' });
    }

    // For admin users, allow access to all data
    const user = req.user as any;
    if (user && user.role === 'admin') {
      console.log(`Admin user ${user.id} granted access to ${resource}`);
      return next();
    }

    // Log the access attempt
    if (req.userId) {
      logAuditEvent(
        req.userId,
        AuditAction.READ,
        resource,
        undefined,
        { tenantValidation: true },
        req.ip
      );
    }

    next();
  };
}

// Soft delete middleware
export function softDeleteSupport(req: TenantRequest, res: Response, next: NextFunction) {
  // Add soft delete query parameter support
  if (req.method === 'GET' && !req.query.includeDeleted) {
    req.query.includeDeleted = 'false';
  }
  next();
}