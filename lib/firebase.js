import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCf6VNLkMzTOV51FFqWHrxB-KBr5Vu_xtM",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "chimney-solutions-nt.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "chimney-solutions-nt",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "chimney-solutions-nt.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "391952557503",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:391952557503:web:b2fefa69b6005c45dcad0a",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-2361S394R0",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// ✅ Safe messaging init (client-side only)
let messaging = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        messaging = getMessaging(app);
        window.firebaseMessaging = messaging;
        console.log("✅ Firebase Messaging initialized");
      } else {
        console.warn("⚠️ Messaging not supported in this browser");
      }
    })
    .catch((err) => {
      console.warn("⚠️ Messaging isSupported check error:", err);
    });
}

export { app, db, messaging, firebaseConfig };
