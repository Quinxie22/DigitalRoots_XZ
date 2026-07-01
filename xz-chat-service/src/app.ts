import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import connectMongoDB from './config/mongodb';
import { verifySocketToken } from './middleware/auth.middleware';
import { setupSocketHandlers } from './sockets/message.handlers';
import chatRoutes from './routes/chat.routes';
import sessionRoutes from './routes/session.routes';
import logger from './utils/logger';

const app = express();
app.set('etag', false);
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

io.use(verifySocketToken);
setupSocketHandlers(io);

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Serve uploads folder locally
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Fallback: If file is not found locally, try to redirect to Cloudinary
app.get('/uploads/:fileName', async (req: express.Request, res: express.Response) => {
  const fileName = req.params.fileName as string;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    res.status(404).send('File not found');
    return;
  }

  const ext = path.extname(fileName).toLowerCase();
  let baseName = path.basename(fileName, ext);
  let isThumbnail = false;

  if (baseName.startsWith('thumb_')) {
    baseName = baseName.substring(6);
    isThumbnail = true;
  }

  let resourceType = 'image';
  let category = 'image';

  if (['.mp4', '.mov', '.avi', '.webm'].includes(ext)) {
    resourceType = 'video';
    category = 'video';
  } else if (['.mp3', '.wav', '.ogg'].includes(ext)) {
    resourceType = 'video';
    category = 'audio';
  } else if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'].includes(ext)) {
    resourceType = 'raw';
    category = 'document';
  }

  const checkUrl = (folder: string) => {
    if (isThumbnail) {
      return `https://res.cloudinary.com/${cloudName}/image/upload/${folder}/${category}s/thumbnails/${baseName}_thumb`;
    }
    return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${folder}/${category}s/${baseName}${ext}`;
  };

  const chatUrl = checkUrl('xz-chat');
  const contentUrl = checkUrl('xz-content');

  // Check if file exists under xz-chat folder first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(chatUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      res.redirect(chatUrl);
      return;
    }
  } catch (err) {
    // Ignore and proceed to next check
  }

  // Check if file exists under xz-content folder
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(contentUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      res.redirect(contentUrl);
      return;
    }
  } catch (err) {
    // Ignore and proceed to default redirect
  }

  // Default redirect to contentUrl
  res.redirect(contentUrl);
});

app.use('/api/chat', chatRoutes);
app.use('/api/sessions', sessionRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'chat-service', timestamp: new Date() });
});

const PORT = process.env.PORT || 3003;

const startServer = async () => {
  try {
    await connectMongoDB();
    
    httpServer.listen(PORT, () => {
      logger.info(`Chat service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, io };