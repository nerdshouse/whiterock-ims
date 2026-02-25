import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const defaultConfig = {
  apiKey: 'AIzaSyAd8JZANxPpqNoUAgV19KCf8UNYnpjx11Y',
  authDomain: 'whiterock-ims.firebaseapp.com',
  projectId: 'whiterock-ims',
  storageBucket: 'whiterock-ims.firebasestorage.app',
  messagingSenderId: '195924200642',
  appId: '1:195924200642:web:3d5d14e891d7884af93f5b',
  measurementId: 'G-Q5DL8QQMQK',
};

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? defaultConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? defaultConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? defaultConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? defaultConfig.appId,
};

let app = null;
let authInstance = null;

if (config.projectId && config.apiKey) {
  try {
    app = initializeApp(config);
    authInstance = getAuth(app);
  } catch (e) {
    console.error('Firebase init failed', e);
  }
}

export const auth = authInstance;
export default app;
