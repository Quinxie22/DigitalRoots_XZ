import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'xz_points';

  try {
    await mongoose.connect(uri, {
      dbName,
    });
    console.log(`[Database] Connected successfully to MongoDB: ${dbName}`);
  } catch (error: any) {
    console.error(`[Database] Connection failure: ${error.message}`);
    process.exit(1);
  }
};
