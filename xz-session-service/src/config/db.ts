import mongoose from 'mongoose';
import logger from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB || 'xz_sessions';
    const mongoURI = `${uri}/${dbName}`;
    
    await mongoose.connect(mongoURI);
    logger.info(`[Session Service DB] Connected successfully to MongoDB: ${dbName}`);
  } catch (error: any) {
    logger.error(`[Session Service DB] Connection failure: ${error.message}`);
    process.exit(1);
  }
};
