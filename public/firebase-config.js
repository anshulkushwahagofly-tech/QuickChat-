// ========================================================
// FIREBASE CONFIGURATION FOR QUICKCHAT REAL PHONE OTP
// ========================================================
// 1. console.firebase.google.com par jaayein (apne Gmail se)
// 2. Naya free project banayein -> Build -> Authentication -> Phone Enable karein
// 3. Project Settings (gear icon) -> General -> Your apps -> Web app (</>) banayein
// 4. Niche diye gaye firebaseConfig me apni keys paste karein:

const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
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
            console.log("Firebase Phone Auth ready!");
        } else {
            console.warn("Firebase not yet configured with real keys. Demo OTP mode active for testing.");
        }
    } catch (e) {
        console.error("Firebase init error:", e);
    }
}
