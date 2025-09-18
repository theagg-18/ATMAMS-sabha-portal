// This file initializes Firebase and exports the services for other modules to use.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const firebaseConfig = {
    apiKey: "AIzaSyBsraiG11tJCu5CYRiQiqe3kaVJShh_cfI",
    authDomain: "atmams-sabhaid-system.firebaseapp.com",
    projectId: "atmams-sabhaid-system",
    storageBucket: "atmams-sabhaid-system.appspot.com",
    messagingSenderId: "187796742502",
    appId: "1:187796742502:web:f6f808cb9d555b67e6a8a7",
    measurementId: "G-0TV419DPH1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-south1");

// Export the initialized services
export { auth, db, functions };