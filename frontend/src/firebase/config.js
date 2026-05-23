// Firebase configuration
// Copy this from Firebase Console → Project Settings → Your apps → Web app
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCaDV6rB4SB9Uwg8lh2fAzy8BgG6u2U2oU",
  authDomain: "smart-placement-system-cmc.firebaseapp.com",
  projectId: "smart-placement-system-cmc",
  storageBucket: "smart-placement-system-cmc.firebasestorage.app",
  messagingSenderId: "668458697649",
  appId: "1:668458697649:web:6a5999179b7c7bedf8f390"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);