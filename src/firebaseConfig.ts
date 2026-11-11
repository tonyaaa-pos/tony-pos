import appletConfig from '../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: appletConfig.apiKey || '',
  authDomain: appletConfig.authDomain || '',
  projectId: appletConfig.projectId || '',
  storageBucket: appletConfig.storageBucket || '',
  messagingSenderId: appletConfig.messagingSenderId || '',
  appId: appletConfig.appId || '',
  firestoreDatabaseId: appletConfig.firestoreDatabaseId || '(default)',
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      !firebaseConfig.apiKey.includes('YOUR_')
  );
}
