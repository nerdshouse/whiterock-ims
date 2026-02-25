import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: 'AIzaSyAd8JZANxPpqNoUAgV19KCf8UNYnpjx11Y',
  authDomain: 'whiterock-ims.firebaseapp.com',
  projectId: 'whiterock-ims',
  appId: '1:195924200642:web:3d5d14e891d7884af93f5b',
};

const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
