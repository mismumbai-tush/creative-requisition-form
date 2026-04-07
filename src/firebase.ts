import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDFjOinpgJFts-FHY4FxRUbyWDGbMFxCzc",
  authDomain: "creative-requisition-form.firebaseapp.com",
  projectId: "creative-requisition-form",
  storageBucket: "creative-requisition-form.firebasestorage.app",
  messagingSenderId: "469243144353",
  appId: "1:469243144353:web:f88578ecc94cc6c3eaa8e0",
  measurementId: "G-ERG4M7WTTH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics only in browser environment
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export default app;
