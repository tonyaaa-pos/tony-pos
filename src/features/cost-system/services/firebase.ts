import { getDocFromServer, doc } from 'firebase/firestore';
import {
  app,
  db,
  auth,
  firebaseConfig,
  isFirebaseConfigured,
  OperationType,
  handleFirestoreError,
  loginWithGoogle as posLoginWithGoogle,
  logoutFromCloud,
  subscribeAuthState,
  getCloudUser,
  isQuotaExceededError,
  isFirestoreWritePaused,
  markFirestoreWriteQuotaExceeded,
  getFriendlyAuthErrorMessage,
} from '../../../services/firebase';

export {
  app,
  db,
  auth,
  firebaseConfig,
  isFirebaseConfigured,
  OperationType,
  handleFirestoreError,
  subscribeAuthState,
  getCloudUser,
  isQuotaExceededError,
  isFirestoreWritePaused,
  markFirestoreWriteQuotaExceeded,
  getFriendlyAuthErrorMessage,
};

export async function testConnection(): Promise<void> {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function loginWithGoogle() {
  try {
    return await posLoginWithGoogle();
  } catch (error: unknown) {
    throw new Error(getFriendlyAuthErrorMessage(error));
  }
}

export async function logoutUser(): Promise<void> {
  await logoutFromCloud();
}
