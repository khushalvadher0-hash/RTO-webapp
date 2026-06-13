// Firebase app initialisation — import this before using db / auth / storage.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// DEBUG: Verify Vite environment variables are loading
console.log("Firebase Config", firebaseConfig);
console.log("API Key:", import.meta.env.VITE_FIREBASE_API_KEY);
console.log("Auth Domain:", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
console.log("Project ID:", import.meta.env.VITE_FIREBASE_PROJECT_ID);
console.log("Storage Bucket:", import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);

// DEBUG: Validate critical fields are present
if (!firebaseConfig.projectId) {
  console.error("VITE_FIREBASE_PROJECT_ID is missing");
}

if (!firebaseConfig.apiKey) {
  console.error("VITE_FIREBASE_API_KEY is missing");
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
console.log("DB instance", db);
export const storage = getStorage(app);
