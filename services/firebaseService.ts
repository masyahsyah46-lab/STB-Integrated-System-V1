
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tapisan-stb-g4-g7.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://tapisan-stb-g4-g7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tapisan-stb-g4-g7",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tapisan-stb-g4-g7.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "471944484216",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:471944484216:web:444b36f32ef52143c4a48d",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-NLQQKWY7BE"
};

// Validate config
const isConfigValid = !!config.apiKey && config.apiKey !== "MISSING_API_KEY";

// Initialize Firebase with fallback to avoid crash
const app = initializeApp(config);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Handle Google Social login via Firebase
 */
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Auth Error:", error);
    throw error;
  }
};

// Helper to ensure user is authenticated for Firestore rules
export const ensureFirebaseAuth = async (): Promise<boolean> => {
  if (!isConfigValid) {
    console.error("Cannot sign in: Firebase configuration is invalid.");
    return false;
  }
  
  if (auth.currentUser) return true;
  
  try {
    console.log("Attempting anonymous Firebase sign-in...");
    const cred = await signInAnonymously(auth);
    console.log("Firebase signed in anonymously:", cred.user.uid);
    return true;
  } catch (error) {
    console.error("Firebase Auth Error:", error);
    return false;
  }
};

// Initialize Analytics
export const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);
