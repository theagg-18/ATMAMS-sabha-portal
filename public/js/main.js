// This is the main entry point for the application's JavaScript.
// It handles initialization and orchestrates the other modules.

import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeAuth } from './auth.js';
import { initializeDashboard, displayDashboard } from './dashboard.js';

// --- Global UI Element References ---
const ui = {
    loadingScreen: document.getElementById('loading-screen'),
    authScreen: document.getElementById('auth-screen'),
    appScreen: document.getElementById('app-screen'),
    
    // Auth related
    authTabs: document.getElementById('auth-tabs'),
    loginForm: document.getElementById('login-form'),
    registerContainer: document.getElementById('register-container'),
    showLoginBtn: document.getElementById('show-login-btn'),
    showRegisterBtn: document.getElementById('show-register-btn'),
    forgotPasswordForm: document.getElementById('forgot-password-form'),
    forgotPasswordLink: document.getElementById('forgot-password-link'),
    backToLoginBtn: document.getElementById('back-to-login-btn'),
    
    // Registration steps
    steps: document.querySelectorAll('.form-step'),
    verifyIdForm: document.getElementById('verify-id-form'),
    findIdForm: document.getElementById('find-id-form'),
    createLoginForm: document.getElementById('create-login-form'),
    registerForm: document.getElementById('register-form'),

    // Dashboard related
    logoutBtn: document.getElementById('logout-btn'),
    userWelcome: document.getElementById('user-welcome'),
    digitalIdCard: document.getElementById('digital-id-card'),
    downloadIdBtn: document.getElementById('download-id-btn'),
    familyTreeContainer: document.getElementById('family-tree-container'),
    changePasswordForm: document.getElementById('change-password-form'),

    // New Add Member Modal
    addFamilyMemberBtn: document.getElementById('add-family-member-btn'),
    addMemberModal: document.getElementById('add-member-modal'),
    closeAddMemberModalBtn: document.getElementById('close-add-member-modal-btn'),
    cancelAddMemberBtn: document.getElementById('cancel-add-member-btn'),
    addMemberForm: document.getElementById('add-member-form'),

    // Utility
    messageModal: document.getElementById('message-modal'),
    modalMessage: document.getElementById('modal-message'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
};

// --- Utility Functions ---
const showMessage = (message) => { 
    ui.modalMessage.textContent = message; 
    ui.messageModal.classList.remove('hidden'); 
};
const goToStep = (stepId) => {
    ui.steps.forEach(step => step.classList.remove('active'));
    document.getElementById(stepId).classList.add('active');
};
const displayRegistrationSuccess = (members) => { /* ... success logic ... */ };

// --- Main Application Logic ---
function main() {
    ui.modalCloseBtn.addEventListener('click', () => ui.messageModal.classList.add('hidden'));

    initializeAuth(ui, showMessage, goToStep, displayRegistrationSuccess);
    initializeDashboard(ui, showMessage);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in. Let's try to show the dashboard.
            ui.loadingScreen.classList.remove('hidden');
            await displayDashboard(user.uid, ui, showMessage);
            ui.authScreen.classList.add('hidden');
            ui.appScreen.classList.remove('hidden');
            ui.loadingScreen.classList.add('hidden');
        } else {
            // User is signed out.
            ui.authScreen.classList.remove('hidden');
            ui.appScreen.classList.add('hidden');
            ui.loadingScreen.classList.add('hidden');
        }
    });

    ui.logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });
}

// Run the main application logic when the DOM is ready
document.addEventListener('DOMContentLoaded', main);