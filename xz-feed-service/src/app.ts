import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import feedRoutes from './routes/feed.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3009;

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use('/api/feed', feedRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'xz-feed-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[Feed Service] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
