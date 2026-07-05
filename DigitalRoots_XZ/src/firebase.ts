// ─────────────────────────────────────────────────────────────────────────────
// firebase.ts — Firebase Client SDK Initialization
//
// HOW TO CONFIGURE:
//   1. Go to https://console.firebase.google.com
//   2. Create a project (or use an existing one)
//   3. Add a Web App (</> icon) → copy the firebaseConfig values
//   4. Fill in the VITE_FIREBASE_* variables in frontend/.env
//   5. In Firebase Console → Authentication → Sign-in method:
//      Enable "Email/Password" and "Google"
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Prevent re-initialization on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

// Google Sign-In provider — prompts the user to pick their Google account every time
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
