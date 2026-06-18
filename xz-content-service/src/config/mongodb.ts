import mongoose from 'mongoose';
import logger from '../utils/logger';

const connectMongoDB = async (): Promise<void> => {
  try {
    const mongoURI = `${process.env.MONGODB_URI}/${process.env.MONGODB_DB}`;
    await mongoose.connect(mongoURI);
    logger.info('MongoDB (Content) connected successfully');
    
    // Create indexes
    await createIndexes();
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const createIndexes = async () => {
  const db = mongoose.connection.db;
  
  // Text search indexes for knowledge articles
  await db?.collection('knowledgearticles').createIndex(
    { title: 'text', content: 'text', tags: 'text' },
    { default_language: 'none' }
  );
  
  // Index for posts by timestamp
  await db?.collection('posts').createIndex({ createdAt: -1 });
  await db?.collection('posts').createIndex({ authorId: 1, createdAt: -1 });
  
  // Index for stories
  await db?.collection('stories').createIndex({ culturalCategory: 1 });
  await db?.collection('stories').createIndex({ isPublished: 1, createdAt: -1 });
  
  logger.info('Database indexes created');
};

export default connectMongoDB;