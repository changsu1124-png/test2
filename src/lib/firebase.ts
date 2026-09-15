import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, Auth, User } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

// Firebase configuration from Vite environment variables
// Supports both standard Vite env vars and fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  (firebaseConfig.databaseURL || firebaseConfig.projectId)
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;

export function getFirebaseInstance() {
  if (!isFirebaseConfigured) {
    return { app: null, auth: null, database: null, isConfigured: false };
  }

  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    database = getDatabase(app);
  }

  return { app, auth, database, isConfigured: true };
}

/**
 * Ensure anonymous sign-in so users can participate without any Google account or login form.
 */
export async function ensureAnonymousAuth(): Promise<User | null> {
  const { auth: currentAuth } = getFirebaseInstance();
  if (!currentAuth) return null;

  if (currentAuth.currentUser) {
    return currentAuth.currentUser;
  }

  try {
    const credential = await signInAnonymously(currentAuth);
    return credential.user;
  } catch (error) {
    console.error('Failed anonymous sign-in:', error);
    throw error;
  }
}
