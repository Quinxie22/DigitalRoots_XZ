import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import logger from '../utils/logger';

// Check if Firebase is configured and not placeholder values
const hasFirebaseConfig = 
  process.env.FIREBASE_PROJECT_ID && 
  process.env.FIREBASE_PROJECT_ID !== 'your-project-id' &&
  process.env.FIREBASE_PRIVATE_KEY && 
  !process.env.FIREBASE_PRIVATE_KEY.includes('YOUR_KEY') &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_CLIENT_EMAIL !== 'firebase-adminsdk@your-project.iam.gserviceaccount.com';

const isMockFirebase = !hasFirebaseConfig;

if (hasFirebaseConfig) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
    });
    logger.info('Firebase Admin initialized for Content Service');
  }
} else {
  logger.warn('Firebase credentials not set or contain placeholders. Running in Mock/Development mode.');
}

export const verifyFirebaseToken = async (token: string): Promise<any> => {
  if (isMockFirebase) {
    // Return mock token verification payload based on input
    // If the token matches predefined users or admin/elder tags, set role accordingly
    let role = 'Youth';
    let name = 'Mock User';
    
    if (token === 'user-arthur' || token.includes('admin')) {
      role = 'Admin';
      name = 'Admin User';
    } else if (token.includes('elder')) {
      role = 'Elder';
      name = 'Elder User';
    }
    
    return {
      uid: token || 'mock-user-123',
      email: `${token || 'mock-user'}@example.com`,
      role,
      name,
    };
  }
  return await getAuth().verifyIdToken(token);
};