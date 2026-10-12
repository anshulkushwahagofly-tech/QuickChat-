// ========================================================
// FIREBASE CONFIGURATION FOR QUICKCHAT REAL PHONE OTP
// ========================================================

const firebaseConfig = {
    apiKey: "AIzaSyC9-48jVcFO8RXMlmvtDIUPETSosJCLiK0",
    authDomain: "quickchat-a506e.firebaseapp.com",
    projectId: "quickchat-a506e",
    storageBucket: "quickchat-a506e.firebasestorage.app",
    messagingSenderId: "119908008465",
    appId: "1:119908008465:web:696c374ed53bf21e19a7b0",
    measurementId: "G-T0XCLKMJZH"
};

// Check if user has entered real keys
function isFirebaseConfigured() {
    return firebaseConfig && 
           firebaseConfig.apiKey && 
           firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" &&
           !firebaseConfig.apiKey.includes("YOUR_");
}

// Global Firebase Auth holder
let firebaseAuth = null;

if (typeof firebase !== 'undefined') {
    try {
        if (isFirebaseConfigured()) {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            firebaseAuth = firebase.auth();
            firebaseAuth.useDeviceLanguage();
            console.log("Firebase Phone Auth ready for QuickChat!");
        } else {
            console.warn("Firebase not configured.");
        }
    } catch (e) {
        console.error("Firebase init error:", e);
    }
}
