import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB4ZZ_mmP50VnYQHoeW5hchvBbKtDW1jTo",
  authDomain: "restaurante1-e657d.firebaseapp.com",
  projectId: "restaurante1-e657d",
  storageBucket: "restaurante1-e657d.firebasestorage.app",
  messagingSenderId: "63501560350",
  appId: "1:63501560350:web:42c2a3e06c44d9c5519c0f",
  measurementId: "G-XCKVZ8K1ZS",
};

const hasConfig = Object.values(firebaseConfig).every(Boolean);

let app;
let db;
let auth;
let analytics;
let firebaseError = null;

try {
  if (!hasConfig) {
    throw new Error("Firebase configuration is missing.");
  }
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {});
} catch (error) {
  firebaseError = error;
}

export { app, db, auth, analytics, firebaseError };
