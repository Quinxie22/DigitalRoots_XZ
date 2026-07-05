import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import compression from 'compression';
import helmet from 'helmet';
import { createServer } from 'http';
import { connectDB } from './config/db';
import sessionRoutes from './routes/session.routes';
import logger from './utils/logger';

dotenv.config();

const app = express();
app.set('etag', false);
const httpServer = createServer(app);

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Force no-cache on all API responses
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Bind routes
app.use('/api/sessions', sessionRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'session-service', timestamp: new Date() });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled session service error:', err);
  res.status(500).json({ success: false, error: 'Internal server error occurred.' });
});

const PORT = process.env.PORT || 3008;

const startServer = async () => {
  try {
    await connectDB();
    httpServer.listen(PORT, () => {
      logger.info(`Session service running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    logger.error('Failed to boot session service application:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, httpServer };
