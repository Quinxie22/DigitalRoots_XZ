// ─────────────────────────────────────────────────────────────────────────────
// auth.middleware.ts — Centralized JWT Authentication for the API Gateway
//
// HOW IT WORKS:
//   1. Extracts the Bearer JWT token from the Authorization header.
//   2. Verifies the token signature using the shared JWT_SECRET.
//   3. Decodes the payload (id, email, role, name).
//   4. Injects the decoded user identity into forwarded request headers:
//        x-user-id, x-user-role, x-user-email, x-user-name
//   5. Downstream microservices trust these headers and skip JWT verification.
//
// PUBLIC ROUTES:
//   Some routes (login, register, health) are whitelisted and bypass auth.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const getJWTSecret = (): string =>
  process.env.JWT_SECRET || 'xz_jwt_secret_shared_2026_key';

// Routes that do NOT require authentication
const PUBLIC_ROUTES: Array<{ method?: string; path: string }> = [
  { method: 'POST', path: '/api/users/login' },
  { method: 'POST', path: '/api/users/register' },
  { method: 'POST', path: '/api/users/firebase-login' },
  { path: '/health' },
  { path: '/favicon.ico' },
];

/**
 * Check whether the incoming request matches a public (no-auth) route.
 */
function isPublicRoute(req: Request): boolean {
  const { method, path } = req;

  // All OPTIONS (CORS preflight) requests are public
  if (method === 'OPTIONS') return true;

  // Static file routes served by downstream services
  if (path.startsWith('/uploads/')) return true;

  // Socket.io connection handshake/polling routes (handled by Socket verifyToken)
  if (path.startsWith('/socket.io/')) return true;

  for (const route of PUBLIC_ROUTES) {
    if (route.method && route.method !== method) continue;
    if (path === route.path || path.startsWith(route.path + '/')) return true;
  }

  return false;
}

/**
 * Gateway authentication middleware.
 * Verifies JWT and injects user identity headers for downstream services.
 */
export const gatewayAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip auth for public routes
  if (isPublicRoute(req)) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided. Use: Authorization: Bearer <jwt_token>',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJWTSecret()) as any;

    // Inject user identity into request headers for downstream services
    req.headers['x-user-id'] = decoded.id || '';
    req.headers['x-user-role'] = decoded.role || 'Youth';
    req.headers['x-user-email'] = decoded.email || '';
    req.headers['x-user-name'] = decoded.name || '';

    // Also keep the original Authorization header so that downstream
    // services that still need the raw token (e.g., WebSocket) can use it
    next();
  } catch (error: any) {
    console.error(`[Gateway] Token verification failed: ${error.message}`);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
};
