/**
 * Firebase Configuration for KinD POS
 *
 * นำค่าการตั้งค่าจาก Firebase Console (Project Settings -> General -> Your apps -> Web app)
 * มาใส่แทนค่า placeholder ด้านล่างนี้:
 *
 * หมายเหตุ:
 * - สำหรับ GitHub Pages (Static hosting) บันทึกไว้ในไฟล์นี้โดยตรง ไม่พึ่งพา .env
 * - หากยังเป็นค่า placeholder ระบบจะทำงานในโหมด Local-first (ออฟไลน์สมบูรณ์) โดยอัตโนมัติ
 */
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

/**
 * ตรวจสอบว่ามีการใส่ค่า Firebase Config จริงแล้วหรือไม่
 */
export function isFirebaseConfigured(): boolean {
  return (
    typeof firebaseConfig.apiKey === 'string' &&
    firebaseConfig.apiKey.length > 10 &&
    firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
    typeof firebaseConfig.projectId === 'string' &&
    firebaseConfig.projectId.length > 3 &&
    firebaseConfig.projectId !== 'YOUR_PROJECT_ID'
  );
}
