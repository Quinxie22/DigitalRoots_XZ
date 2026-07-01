// ─────────────────────────────────────────────────────────────────────────────
// index.ts — XZ Digital Roots API Gateway
//
// ARCHITECTURE:
//   This is the single entry point for all client requests. It:
//   1. Applies CORS, security headers, and request logging.
//   2. Runs centralized JWT authentication (via gatewayAuth middleware).
//   3. Proxies requests to the appropriate downstream microservice based on
//      URL path prefix.
//   4. Handles WebSocket upgrade requests for Socket.IO (real-time chat).
//
// ROUTE MAP:
//   /api/users/*         →  xz-user-service:3006
//   /api/content/*       →  xz-content-service:3005
//   /api/chat/*          →  xz-chat-service:3004
//   /api/sessions/*      →  xz-chat-service:3004
//   /uploads/*           →  xz-chat-service:3004 (static media files)
//   /api/feed/*          →  xz-feed-service:3009
//   /api/notifications/* →  xz-notification-service:3010
//   /api/points/*        →  xz-point-service:3007
//   /socket.io/*         →  xz-chat-service:3004 (WebSocket)
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { gatewayAuth } from './auth.middleware';

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

// ── Global Middleware ────────────────────────────────────────────────────────

app.use(cors());
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(morgan('short'));

// ── Gateway Health Check ─────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'xz-api-gateway',
    timestamp: new Date().toISOString(),
  });
});

// ── Centralized Authentication ───────────────────────────────────────────────
// This middleware runs BEFORE any proxy. It verifies the JWT and injects
// x-user-* headers into the request for downstream services.

app.use(gatewayAuth);

// ── Service URLs (resolved via Docker network DNS) ───────────────────────────

const USER_SERVICE     = process.env.USER_SERVICE_URL     || 'http://xz-user-service:3006';
const CONTENT_SERVICE  = process.env.CONTENT_SERVICE_URL  || 'http://xz-content-service:3005';
const CHAT_SERVICE     = process.env.CHAT_SERVICE_URL     || 'http://xz-chat-service:3004';
const FEED_SERVICE     = process.env.FEED_SERVICE_URL     || 'http://xz-feed-service:3009';
const NOTIF_SERVICE    = process.env.NOTIFICATION_SERVICE_URL || 'http://xz-notification-service:3010';
const POINT_SERVICE    = process.env.POINT_SERVICE_URL    || 'http://xz-point-service:3007';

// ── Helper: Create proxy config ──────────────────────────────────────────────

function proxyTo(target: string, prefix: string, wsSupport = false): Options {
  return {
    target,
    changeOrigin: true,
    ws: wsSupport,
    // Add pathRewrite because Express app.use('/prefix', ...) strips the prefix
    // from req.url before it reaches http-proxy-middleware.
    pathRewrite: (path, req) => {
      if (path.startsWith(prefix)) return path;
      return `${prefix}${path}`;
    },
    // Log proxy errors but don't crash
    on: {
      error: (err, _req, res) => {
        console.error(`[Gateway] Proxy error to ${target}:`, err.message);
        if (res && 'status' in res && typeof (res as any).status === 'function') {
          (res as any).status(502).json({
            error: 'Bad Gateway',
            message: `Downstream service at ${target} is unavailable`,
          });
        }
      },
    },
  };
}

// ── Proxy Routes ─────────────────────────────────────────────────────────────
// Order matters: more specific paths first.

// User Service
app.use('/api/users', createProxyMiddleware(proxyTo(USER_SERVICE, '/api/users')));

// Content Service (posts, stories, knowledge, moderation)
app.use('/api/content', createProxyMiddleware(proxyTo(CONTENT_SERVICE, '/api/content')));

// Chat Service (threads, messages)
app.use('/api/chat', createProxyMiddleware(proxyTo(CHAT_SERVICE, '/api/chat')));

// Session Service (mentoring sessions — also on Chat Service)
app.use('/api/sessions', createProxyMiddleware(proxyTo(CHAT_SERVICE, '/api/sessions')));

// Feed Service (aggregated feed)
app.use('/api/feed', createProxyMiddleware(proxyTo(FEED_SERVICE, '/api/feed')));

// Notification Service
app.use('/api/notifications', createProxyMiddleware(proxyTo(NOTIF_SERVICE, '/api/notifications')));

// Point / Gamification Service
app.use('/api/points', createProxyMiddleware(proxyTo(POINT_SERVICE, '/api/points')));

// Static file uploads (served by chat service)
app.use('/uploads', createProxyMiddleware(proxyTo(CHAT_SERVICE, '/uploads')));

// Socket.IO — WebSocket proxy with upgrade support (prefix not stripped if custom check)
const socketProxy = createProxyMiddleware(proxyTo(CHAT_SERVICE, '/socket.io', true));
app.use('/socket.io', socketProxy);

// ── 404 Fallback ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested API route does not exist. Check the URL path.',
  });
});

// ── Start Server ─────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`\n🚀 XZ API Gateway running on port ${PORT}`);
  console.log(`   Routes:`);
  console.log(`     /api/users/*         → ${USER_SERVICE}`);
  console.log(`     /api/content/*       → ${CONTENT_SERVICE}`);
  console.log(`     /api/chat/*          → ${CHAT_SERVICE}`);
  console.log(`     /api/sessions/*      → ${CHAT_SERVICE}`);
  console.log(`     /api/feed/*          → ${FEED_SERVICE}`);
  console.log(`     /api/notifications/* → ${NOTIF_SERVICE}`);
  console.log(`     /api/points/*        → ${POINT_SERVICE}`);
  console.log(`     /socket.io/*         → ${CHAT_SERVICE} (WebSocket)`);
  console.log(`     /uploads/*           → ${CHAT_SERVICE} (static)\n`);
});

// Handle WebSocket upgrade at the HTTP server level
server.on('upgrade', (req, socket, head) => {
  console.log(`[Gateway] WebSocket upgrade request: ${req.url}`);
  if (req.url?.startsWith('/socket.io')) {
    socketProxy.upgrade(req, socket as any, head);
  }
});
