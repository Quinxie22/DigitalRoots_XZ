import mongoose from 'mongoose';
import { User } from '../models/user.model';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'xz_users';

  try {
    await mongoose.connect(uri, {
      dbName,
    });
    console.log(`[Database] Connected successfully to MongoDB: ${dbName}`);
    
    // Seed default administrator if none exists
    const adminExists = await User.findOne({ role: 'Admin' });
    if (!adminExists) {
      const admin = new User({
        email: 'admin@digitalroots.com',
        password: 'admin123',
        name: 'System Administrator',
        role: 'Admin',
        avatar: 'SA',
        bio: 'Default System Administrator account.',
        community: 'System',
        languages: ['English', 'French'],
        contentPreferences: ['Cultural', 'Educational']
      });
      await admin.save();
      console.log('[Database] Seeded default Admin user: admin@digitalroots.com / admin123');
    }
  } catch (error: any) {
    console.error(`[Database] Connection failure: ${error.message}`);
    process.exit(1);
  }
};

