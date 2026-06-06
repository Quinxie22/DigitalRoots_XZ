import admin from 'firebase-admin';
import logger from '../utils/logger';

// Check if Firebase is configured
const hasFirebaseConfig = 
  process.env.FIREBASE_PROJECT_ID && 
  process.env.FIREBASE_PRIVATE_KEY && 
  process.env.FIREBASE_CLIENT_EMAIL;

const isMockFirebase = !hasFirebaseConfig;

if (hasFirebaseConfig) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    logger.info('Firebase Admin initialized for token verification');
  }
} else {
  logger.warn('Firebase credentials not fully set in .env. Running Firebase in Mock/Development mode.');
}

export const verifyFirebaseToken = async (token: string): Promise<any> => {
  if (isMockFirebase) {
    return {
      uid: token === 'mock-token' || !token ? 'mock-user-123' : token,
      email: 'mock-user@example.com',
      role: 'Youth',
    };
  }
  return await admin.auth().verifyIdToken(token);
};

export default admin;