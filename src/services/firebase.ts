import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from '../firebaseConfig';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (typeof window !== 'undefined' && isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

    try {
      db = initializeFirestore(
        app,
        {
          ignoreUndefinedProperties: true,
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        firebaseConfig.firestoreDatabaseId
      );
    } catch (dbInitErr) {
      console.warn('[Firebase] initializeFirestore with persistentLocalCache fallback to getFirestore:', dbInitErr);
      db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }

    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('[Firebase Auth] setPersistence error:', err);
    });

    // Validate connection to Firestore on startup
    if (db) {
      const firestoreInstance = db;
      (async function testConnection() {
        try {
          await getDocFromServer(doc(firestoreInstance, 'test', 'connection'));
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error('Please check your Firebase configuration.');
          }
        }
      })();
    }
  } catch (err) {
    console.warn('[Firebase] Setup skipped or failed:', err);
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { app, db, auth, firebaseConfig, isFirebaseConfigured };

export async function loginToCloud(email: string, pass: string): Promise<FirebaseUser> {
  if (!auth) {
    if (!isFirebaseConfigured()) {
      throw new Error('ยังไม่ได้กำหนดค่า Firebase ใน firebase-applet-config.json');
    }
    throw new Error('ระบบเชื่อมต่อ Firebase Auth ไม่พร้อมใช้งาน');
  }
  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return credential.user;
}

export async function loginWithGoogle(): Promise<FirebaseUser> {
  if (!auth) {
    if (!isFirebaseConfigured()) {
      throw new Error('ยังไม่ได้กำหนดค่า Firebase ใน firebase-applet-config.json');
    }
    throw new Error('ระบบเชื่อมต่อ Firebase Auth ไม่พร้อมใช้งาน');
  }
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
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

export function getFriendlyAuthErrorMessage(error: unknown): string {
  const errObj = error as { code?: string; message?: string } | null;
  const code = errObj?.code || '';
  const message = errObj?.message || (error instanceof Error ? error.message : String(error || ''));
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const projectId = firebaseConfig.projectId || 'Firebase';

  if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
    const isIpAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
    if (isIpAddress) {
      return `โดเมน "${hostname}" ยังไม่ได้รับอนุญาตให้เข้าสู่ระบบ Google (auth/unauthorized-domain)\nเนื่องจากกำลังเปิดผ่าน IP Address โดยตรง ระบบ Google Sign-In จะไม่อนุญาตให้ใช้ IP ให้เปิดแอปผ่านลิงก์ HTTPS (เช่น GitHub Pages หรือ AI Studio App URL) แล้วนำโดเมนนั้นไปเพิ่มใน Firebase Console → Authentication → Settings → Authorized domains (โปรเจกต์: ${projectId})`;
    }
    return `โดเมน "${hostname || 'ปัจจุบัน'}" ยังไม่ได้รับอนุญาตให้เข้าสู่ระบบ Cloud (auth/unauthorized-domain)\nวิธีแก้ไข: เปิด Firebase Console (โปรเจกต์ ${projectId}) → Authentication → Settings → Authorized domains → กด Add domain แล้วเพิ่มโดเมน "${hostname || 'จากแถบที่อยู่บนเครื่อง'}" จากนั้นรีเฟรชหน้านี้แล้วลองใหม่อีกครั้ง`;
  }

  if (code === 'auth/popup-blocked' || message.includes('auth/popup-blocked')) {
    return 'เบราว์เซอร์บนเครื่องนี้บล็อกหน้าต่างป๊อปอัป (Popup) กรุณาอนุญาตป๊อปอัป (Allow Pop-ups) สำหรับเว็บไซต์นี้ แล้วกด "เข้าสู่ระบบด้วย Google" อีกครั้ง';
  }

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    message.includes('auth/popup-closed-by-user')
  ) {
    return 'หน้าต่างเข้าสู่ระบบ Google ถูกปิดก่อนดำเนินการเสร็จสิ้น กรุณากดลองใหม่อีกครั้ง';
  }

  if (code === 'auth/operation-not-allowed' || message.includes('auth/operation-not-allowed')) {
    return 'ระบบเข้าสู่ระบบด้วยอีเมลและรหัสผ่านยังไม่ได้เปิดใช้งานใน Firebase Console แนะนำให้กดปุ่ม "เข้าสู่ระบบด้วย Google" แทน (หรือเปิดใช้งาน Email/Password ใน Firebase Console → Authentication → Sign-in method)';
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง (หากบัญชีนี้ใช้ Google Login ให้กดปุ่ม "เข้าสู่ระบบด้วย Google" แทน)';
  }

  if (code === 'auth/too-many-requests') {
    return 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
  }

  if (code === 'auth/network-request-failed' || message.includes('auth/network-request-failed')) {
    return 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตหรือเซิร์ฟเวอร์ Firebase ได้ กรุณาตรวจสอบการเชื่อมต่อ Wi-Fi / อินเทอร์เน็ต';
  }

  return message || 'ไม่สามารถเข้าสู่ระบบ Cloud ได้ กรุณาลองใหม่อีกครั้ง';
}

