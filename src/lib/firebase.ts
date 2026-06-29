import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use standard getFirestore to avoid IndexedDB issues in restricted iframes
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
