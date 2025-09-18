// This file handles all logic for authentication: login, registration, password reset, etc.

import { auth, db, functions } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, collection, runTransaction, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// This function will be called by main.js to set up all event listeners
export function initializeAuth(ui, showMessage, goToStep, displayRegistrationSuccess) {
    const { loginForm, forgotPasswordForm, forgotPasswordLink, backToLoginBtn, registerContainer, showLoginBtn, showRegisterBtn, authTabs, verifyIdForm, findIdForm, createLoginForm, registerForm } = ui;

    // --- Event Listeners for switching forms ---
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerContainer.classList.add('hidden');
        forgotPasswordForm.classList.remove('hidden');
        authTabs.classList.add('hidden');
    });

    backToLoginBtn.addEventListener('click', () => {
        forgotPasswordForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        authTabs.classList.remove('hidden');
    });

    showLoginBtn.addEventListener('click', () => { 
        loginForm.style.display = 'block'; 
        registerContainer.style.display = 'none'; 
        forgotPasswordForm.classList.add('hidden');
        authTabs.classList.remove('hidden');
        showLoginBtn.classList.add('border-blue-600', 'text-blue-600'); 
        showRegisterBtn.classList.remove('border-blue-600', 'text-blue-600'); 
    });

    showRegisterBtn.addEventListener('click', () => { 
        loginForm.style.display = 'none'; 
        registerContainer.style.display = 'block'; 
        forgotPasswordForm.classList.add('hidden');
        authTabs.classList.remove('hidden');
        goToStep('step-initial-question'); 
        showRegisterBtn.classList.add('border-blue-600', 'text-blue-600'); 
        showLoginBtn.classList.remove('border-blue-600', 'text-blue-600'); 
    });

    // --- Form Submission Logic ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Login logic is now handled by onAuthStateChanged in main.js
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;
        try {
            ui.loadingScreen.classList.remove('hidden');
            await signInWithEmailAndPassword(auth, email, password);
        } catch(error) {
            let friendlyMessage = `Login Failed: ${error.message}`;
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                friendlyMessage = "Login Failed: The email or password you entered is incorrect.";
            }
            showMessage(friendlyMessage);
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });

    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        ui.loadingScreen.classList.remove('hidden');
        try {
            await sendPasswordResetEmail(auth, email);
            showMessage("Password reset link sent! Please check your email inbox (and spam folder).");
            backToLoginBtn.click();
        } catch (error) {
            console.error("Password reset failed:", error);
            showMessage(`Error: ${error.message}`);
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });

    verifyIdForm.addEventListener('submit', async (e) => { /* ... verification logic ... */ });
    findIdForm.addEventListener('submit', async (e) => { /* ... find logic ... */ });
    createLoginForm.addEventListener('submit', async (e) => { /* ... create logic ... */ });
    registerForm.addEventListener('submit', async (e) => { /* ... full registration logic ... */ });
}