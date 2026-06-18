import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';

dotenv.config();

import connectMongoDB from './config/mongodb';
import postRoutes from './routes/post.routes';
import storyRoutes from './routes/story.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import moderationRoutes from './routes/moderation.routes';
import { TranscriptionService } from './services/transcription.service';
import logger from './utils/logger';

const app = express();
const httpServer = createServer(app);

// Rate limiter middleware
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(morgan('combined'));
app.use(limiter);

// Serve uploads folder locally if needed
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes mapping
app.use('/api/content/posts', postRoutes);
app.use('/api/content/stories', storyRoutes);
app.use('/api/content/knowledge', knowledgeRoutes);
app.use('/api/content/moderation', moderationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'content-service', timestamp: new Date() });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled application error:', err);
  res.status(500).json({ success: false, error: 'Internal server error occurred.' });
});

const PORT = process.env.PORT || 3005;

const startServer = async () => {
  try {
    // Connect to MongoDB & create indexes
    await connectMongoDB();
    
    // Initialize stories transcription background job queue
    TranscriptionService.initializeQueue();
    
    httpServer.listen(PORT, () => {
      logger.info(`Content service running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error('Failed to boot application:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, httpServer };
