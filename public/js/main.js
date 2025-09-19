// Version: 2.0.2 - Final Verified
// This is the main entry point for the application's JavaScript.
// It handles initialization and orchestrates the other modules.

import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeAuth } from './auth.js';
import { initializeDashboard, displayDashboard } from './dashboard.js';

// --- Main Application Logic ---
function main() {
    // This function runs only after the entire HTML document is fully built.
    const ui = {
        loadingScreen: document.getElementById('loading-screen'),
        authScreen: document.getElementById('auth-screen'),
        appScreen: document.getElementById('app-screen'),
        authTabs: document.getElementById('auth-tabs'),
        loginForm: document.getElementById('login-form'),
        registerContainer: document.getElementById('register-container'),
        showLoginBtn: document.getElementById('show-login-btn'),
        showRegisterBtn: document.getElementById('show-register-btn'),
        forgotPasswordForm: document.getElementById('forgot-password-form'),
        forgotPasswordLink: document.getElementById('forgot-password-link'),
        backToLoginBtn: document.getElementById('back-to-login-btn'),
        
        // Registration Steps & Forms
        steps: document.querySelectorAll('.form-step'),
        btnHasId: document.getElementById('btn-has-id'),
        btnNoId: document.getElementById('btn-no-id'),
        btnSkipToRegister: document.getElementById('btn-skip-to-register'),
        verifyIdForm: document.getElementById('verify-id-form'),
        findIdForm: document.getElementById('find-id-form'),
        createLoginForm: document.getElementById('create-login-form'),
        registerForm: document.getElementById('register-form'),

        // Registration - Family Toggles
        addSpouseToggle: document.getElementById('add-spouse-toggle'),
        spouseDetails: document.getElementById('spouse-details'),
        linkFatherToggle: document.getElementById('link-father-toggle'),
        fatherLinkDetails: document.getElementById('father-link-details'),
        linkMotherToggle: document.getElementById('link-mother-toggle'),
        motherLinkDetails: document.getElementById('mother-link-details'),

        // Dashboard Elements
        logoutBtn: document.getElementById('logout-btn'),
        userWelcome: document.getElementById('user-welcome'),
        digitalIdCard: document.getElementById('digital-id-card'),
        downloadIdBtn: document.getElementById('download-id-btn'),
        familyTreeContainer: document.getElementById('family-tree-container'),
        changePasswordForm: document.getElementById('change-password-form'),
        addFamilyMemberBtn: document.getElementById('add-family-member-btn'),
        
        // Modals
        addMemberModal: document.getElementById('add-member-modal'),
        closeAddMemberModalBtn: document.getElementById('close-add-member-modal-btn'),
        cancelAddMemberBtn: document.getElementById('cancel-add-member-btn'),
        addMemberForm: document.getElementById('add-member-form'),
        newMemberRelation: document.getElementById('new-member-relation'),
        addMemberFieldsContainer: document.getElementById('add-member-fields-container'),
        messageModal: document.getElementById('message-modal'),
        modalMessage: document.getElementById('modal-message'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        
        // Success Screen
        successIdList: document.getElementById('success-id-list'),
        btnProceedDashboard: document.getElementById('btn-proceed-dashboard'),

        // Photo Upload
        photoUploadInput: document.getElementById('photo-upload-input'),
        photoPreview: document.getElementById('photo-preview'),
        uploadPhotoBtn: document.getElementById('upload-photo-btn'),
        photoPlaceholderText: document.getElementById('photo-placeholder-text'),
    };

    const showMessage = (message) => { 
        ui.modalMessage.textContent = message; 
        ui.messageModal.classList.remove('hidden'); 
    };
    const goToStep = (stepId) => {
        ui.steps.forEach(step => step.classList.remove('active'));
        document.getElementById(stepId).classList.add('active');
    };
    const displayRegistrationSuccess = (members) => {
        ui.successIdList.innerHTML = '';
        members.forEach(member => {
            const listItem = document.createElement('div');
            listItem.className = 'flex items-center justify-between p-3 bg-white rounded-md border';
            listItem.innerHTML = `<div><p class="font-semibold text-gray-800">${member.fullName}</p><p class="text-sm text-gray-500">${member.sabhaId}</p></div><button class="download-new-id-btn text-sm bg-gray-700 text-white px-3 py-1.5 rounded-md hover:bg-gray-800" data-name="${member.fullName}" data-id="${member.sabhaId}" data-email="${member.email || ''}" data-phone="${member.phone || ''}">Download ID</button>`;
            ui.successIdList.appendChild(listItem);
        });
        goToStep('step-registration-success');
    };

    ui.modalCloseBtn.addEventListener('click', () => ui.messageModal.classList.add('hidden'));

    // Initialize the other modules and pass them all the UI elements they need
    initializeAuth(ui, showMessage, goToStep, displayRegistrationSuccess);
    initializeDashboard(ui, showMessage);

    // This is the main controller that shows either the login page or the dashboard
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            ui.loadingScreen.classList.remove('hidden');
            const success = await displayDashboard(user.uid, ui, showMessage);
            if (success) {
                ui.authScreen.classList.add('hidden');
                ui.appScreen.classList.remove('hidden');
            } else {
                // This happens if the user's data can't be found after login
                ui.authScreen.classList.remove('hidden');
                ui.appScreen.classList.add('hidden');
            }
            ui.loadingScreen.classList.add('hidden');
        } else {
            // No user is logged in, show the authentication screen
            ui.authScreen.classList.remove('hidden');
            ui.appScreen.classList.add('hidden');
            ui.loadingScreen.classList.add('hidden');
        }
    });

    ui.logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });
}

// Run the main application logic only when the DOM is fully loaded and ready
document.addEventListener('DOMContentLoaded', main);