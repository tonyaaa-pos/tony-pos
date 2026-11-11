import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from '../firebaseConfig';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (typeof window !== 'undefined' && isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch (dbInitErr) {
      console.warn('[Firebase] initializeFirestore with persistentLocalCache fallback to getFirestore:', dbInitErr);
      db = getFirestore(app);
    }

    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('[Firebase Auth] setPersistence error:', err);
    });
  } catch (err) {
    console.warn('[Firebase] Setup skipped or failed:', err);
  }
}

export { app, db, auth, isFirebaseConfigured };

export async function loginToCloud(email: string, pass: string): Promise<FirebaseUser> {
  if (!auth) {
    if (!isFirebaseConfigured()) {
      throw new Error('ยังไม่ได้กำหนดค่า Firebase ใน src/firebaseConfig.ts');
    }
    throw new Error('ระบบเชื่อมต่อ Firebase Auth ไม่พร้อมใช้งาน');
  }
  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return credential.user;
}

export async function logoutFromCloud(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

export function subscribeAuthState(callback: (user: FirebaseUser | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getCloudUser(): FirebaseUser | null {
  return auth ? auth.currentUser : null;
}
