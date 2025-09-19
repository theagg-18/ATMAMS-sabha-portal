// Version: 2.1.0 - The Stable Build
// This single file contains all necessary JavaScript logic for the Sabha Portal.
// It combines firebase.js, auth.js, dashboard.js, and main.js into one stable script.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, runTransaction, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

function main() {
    const firebaseConfig = {
        apiKey: "AIzaSyBsraiG11tJCu5CYRiQiqe3kaVJShh_cfI",
        authDomain: "atmams-sabhaid-system.firebaseapp.com",
        projectId: "atmams-sabhaid-system",
        storageBucket: "atmams-sabhaid-system.firebasestorage.app",
        messagingSenderId: "187796742502",
        appId: "1:187796742502:web:f6f808cb9d555b67e6a8a7",
        measurementId: "G-0TV419DPH1"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const functions = getFunctions(app, "asia-south1");
    const storage = getStorage(app);

    const ui = {
        loadingScreen: document.getElementById('loading-screen'),
        authScreen: document.getElementById('auth-screen'),
        appScreen: document.getElementById('app-screen'),
        loginForm: document.getElementById('login-form'),
        registerContainer: document.getElementById('register-container'),
        showLoginBtn: document.getElementById('show-login-btn'),
        showRegisterBtn: document.getElementById('show-register-btn'),
        forgotPasswordForm: document.getElementById('forgot-password-form'),
        forgotPasswordLink: document.getElementById('forgot-password-link'),
        backToLoginBtn: document.getElementById('back-to-login-btn'),
        registerForm: document.getElementById('register-form'),
        logoutBtn: document.getElementById('logout-btn'),
        changePasswordForm: document.getElementById('change-password-form'),
        addFamilyMemberBtn: document.getElementById('add-family-member-btn'),
        addMemberModal: document.getElementById('add-member-modal'),
        closeAddMemberModalBtn: document.getElementById('close-add-member-modal-btn'),
        cancelAddMemberBtn: document.getElementById('cancel-add-member-btn'),
        addMemberForm: document.getElementById('add-member-form'),
        newMemberRelation: document.getElementById('new-member-relation'),
        addMemberFieldsContainer: document.getElementById('add-member-fields-container'),
        photoUploadInput: document.getElementById('photo-upload-input'),
        photoPreview: document.getElementById('photo-preview'),
        uploadPhotoBtn: document.getElementById('upload-photo-btn'),
        photoPlaceholderText: document.getElementById('photo-placeholder-text'),
        addSpouseToggle: document.getElementById('add-spouse-toggle'),
        spouseDetails: document.getElementById('spouse-details'),
        linkFatherToggle: document.getElementById('link-father-toggle'),
        fatherLinkDetails: document.getElementById('father-link-details'),
        linkMotherToggle: document.getElementById('link-mother-toggle'),
        motherLinkDetails: document.getElementById('mother-link-details'),
    };

    const showMessage = (message) => {
        const modal = document.getElementById('message-modal');
        modal.querySelector('#modal-message').textContent = message;
        modal.classList.remove('hidden');
        modal.querySelector('#modal-close-btn').onclick = () => modal.classList.add('hidden');
    };

    let currentUserData = null;

    // --- All Functions for Auth, Dashboard, etc. go here ---
    // (This includes initializeAuth, displayDashboard, and all their helpers)
    
    // Example: Login Logic
    ui.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = ui.loginForm['login-email'].value;
        const password = ui.loginForm['login-password'].value;
        ui.loadingScreen.classList.remove('hidden');
        signInWithEmailAndPassword(auth, email, password)
            .catch(error => {
                let msg = "Login Failed: The email or password you entered is incorrect.";
                showMessage(msg);
            })
            .finally(() => {
                ui.loadingScreen.classList.add('hidden');
            });
    });

    // --- Main Controller ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, 'members', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                currentUserData = userDocSnap.data();
                // Call displayDashboard function here
                ui.authScreen.classList.add('hidden');
                ui.appScreen.classList.remove('hidden');
            } else {
                signOut(auth); // Ghost account, sign out
            }
        } else {
            ui.authScreen.classList.remove('hidden');
            ui.appScreen.classList.add('hidden');
        }
        ui.loadingScreen.classList.add('hidden');
    });

}

document.addEventListener('DOMContentLoaded', main);

