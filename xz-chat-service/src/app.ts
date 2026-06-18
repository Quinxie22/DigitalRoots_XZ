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
import logger from './utils/logger';

const app = express();
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

app.use('/api/chat', chatRoutes);

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