// ===== Firebase Configuration =====
// Hardcoded Firebase config (no .env needed)
const firebaseConfig = {
  apiKey: "AIzaSyCYsD5avcJWzW_SOvuNWD4ZRRrNFiXtH-o",
  authDomain: "lost-and-found-ba220.firebaseapp.com",
  projectId: "lost-and-found-ba220",
  databaseURL:
    "https://lost-and-found-ba220-default-rtdb.asia-southeast1.firebasedatabase.app/",
  storageBucket: "lost-and-found-ba220.firebasestorage.app",
  messagingSenderId: "135912601274",
  appId: "1:135912601274:web:7f84995c81f748c448f483",
  measurementId: "G-NEGQTKZZJS",
};

// Initialize Firebase (using compat CDN loaded in index.html)
firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics();
const db = firebase.database(); // Realtime Database instance

console.log("Firebase initialized successfully — Realtime Database active.");
