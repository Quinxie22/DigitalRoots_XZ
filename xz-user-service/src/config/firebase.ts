import admin from 'firebase-admin';

const logger = console; // user-service has no utils/logger folder in this repo


// Check if Firebase is configured
const hasFirebaseConfig =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_PRIVATE_KEY &&
  process.env.FIREBASE_CLIENT_EMAIL;

const isMockFirebase = !hasFirebaseConfig;

if (hasFirebaseConfig) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID as string,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') as string,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
  };

  // TypeScript in this repo may not know firebase-admin static typings (apps/credential/auth)
  // so we rely on initializeApp always being safe.
  try {
    admin.initializeApp({
      credential: (admin as any).credential.cert(serviceAccount as any),
    });
    logger.info('Firebase Admin initialized for token verification');
  } catch (e) {
    // initializeApp throws if already initialized; ignore
  }
} else {
  logger.warn('Firebase credentials not fully set in .env. Running Firebase in Mock/Development mode.');
}

export const verifyFirebaseToken = async (token: string): Promise<any> => {
  if (isMockFirebase) {
    return {
      uid: token === 'mock-token' || !token ? 'mock-user-123' : token,
      email: 'mock-user@example.com',
    };
  }

  // Firebase ID token verification
  return await (admin as any).auth().verifyIdToken(token);
};

export default admin;

