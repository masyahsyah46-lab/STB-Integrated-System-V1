import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCiRTUSrEm7mxZ4Hzfb2iT3QevF9tZm6xA", // fallback sementara
  authDomain: "tapisan-stb-g4-g7.firebaseapp.com",
  databaseURL: "https://tapisan-stb-g4-g7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tapisan-stb-g4-g7",
  storageBucket: "tapisan-stb-g4-g7.firebasestorage.app",
  messagingSenderId: "471944484216",
  appId: "1:471944484216:web:444b36f32ef52143c4a48d",
  measurementId: "G-NLQQKWY7BE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Helper to ensure user is authenticated for Firestore rules
export const ensureFirebaseAuth = async (): Promise<boolean> => {
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
