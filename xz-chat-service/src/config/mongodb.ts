import mongoose from 'mongoose';
import logger from '../utils/logger';

const connectMongoDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI || process.env.mongodb_uri || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB || process.env.mongodb_db_name || 'xz_chat_db';
    const mongoURI = `${uri}/${dbName}`;
    await mongoose.connect(mongoURI);
    logger.info('MongoDB connected successfully');
    
    // Create indexes
    await createIndexes();
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const createIndexes = async () => {
  const db = mongoose.connection.db;
  
  // Messages TTL index (auto-delete after 1 year)
  await db?.collection('messages').createIndex(
    { timestamp: 1 },
    { expireAfterSeconds: 31536000 } // 1 year
  );
  
  logger.info('Database indexes created');
};

export default connectMongoDB;