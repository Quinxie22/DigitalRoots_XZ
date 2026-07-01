import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const logger = console;

// ─── Lazy initialization ─────────────────────────────────────────────────────
// We initialize on first call rather than at module load time so that dotenv
// has always been configured by the time we read process.env variables.
let initialized = false;
let isMock = false;

function initFirebase() {
  if (initialized) return;
  initialized = true;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    logger.warn('[Firebase] Credentials not fully set. Running in Mock/Development mode.');
    isMock = true;
    return;
  }

  try {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        }),
      });
      logger.info('[Firebase] Admin SDK initialized successfully ✓');
    } else {
      logger.info('[Firebase] Admin SDK already initialized ✓');
    }
  } catch (e: any) {
    if (e.code === 'app/duplicate-app') {
      logger.info('[Firebase] Admin SDK already initialized ✓');
    } else {
      logger.error('[Firebase] Admin SDK initialization error:', e.message);
      isMock = true;
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────
export const verifyFirebaseToken = async (token: string): Promise<any> => {
  initFirebase(); // ensure SDK is ready on first use

  if (isMock) {
    // Firebase credentials not configured — refuse all token verification
    // rather than silently accepting any token as a valid user.
    throw new Error('[Firebase] Token verification unavailable: Firebase Admin SDK credentials are not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  }

  return await getAuth().verifyIdToken(token);
};

