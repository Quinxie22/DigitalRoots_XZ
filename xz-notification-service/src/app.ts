import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import notificationRoutes from './routes/notification.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3010;

connectDB();

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use('/api/notifications', notificationRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'xz-notification-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[Notification Service] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
