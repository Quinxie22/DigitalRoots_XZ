import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import userRoutes from './routes/user.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;

// ── Disable ETag to prevent 304 Not Modified responses ──────────
// By default Express generates an ETag for every GET response.
// Browsers then cache the response and send If-None-Match on the
// next request — the server replies 304 (no body, res.ok=false).
// The frontend session check treats any non-200 as auth failure,
// deletes the token, and logs the user out unexpectedly.
app.set('etag', false);

// Connect to Database
connectDB();

// Bind Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Force no-cache on all API responses (belt-and-suspenders with etag:false)
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Bind Routes
app.use('/api/users', userRoutes);

// Root / Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'xz-user-service',
    timestamp: new Date().toISOString()
  });
});

// Start listening
app.listen(PORT, () => {
  console.log(`[User Service] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

