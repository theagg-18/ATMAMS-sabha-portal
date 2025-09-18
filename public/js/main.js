// This is the main entry point for the application's JavaScript.
// It handles initialization and orchestrates the other modules.

import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeAuth } from './auth.js';
import { initializeDashboard, displayDashboard } from './dashboard.js';

function main() {
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
        steps: document.querySelectorAll('.form-step'),
        btnHasId: document.getElementById('btn-has-id'),
        btnNoId: document.getElementById('btn-no-id'),
        btnSkipToRegister: document.getElementById('btn-skip-to-register'),
        verifyIdForm: document.getElementById('verify-id-form'),
        findIdForm: document.getElementById('find-id-form'),
        createLoginForm: document.getElementById('create-login-form'),
        registerForm: document.getElementById('register-form'),
        logoutBtn: document.getElementById('logout-btn'),
        userWelcome: document.getElementById('user-welcome'),
        digitalIdCard: document.getElementById('digital-id-card'),
        downloadIdBtn: document.getElementById('download-id-btn'),
        familyTreeContainer: document.getElementById('family-tree-container'),
        changePasswordForm: document.getElementById('change-password-form'),
        addFamilyMemberBtn: document.getElementById('add-family-member-btn'),
        addMemberModal: document.getElementById('add-member-modal'),
        closeAddMemberModalBtn: document.getElementById('close-add-member-modal-btn'),
        cancelAddMemberBtn: document.getElementById('cancel-add-member-btn'),
        addMemberForm: document.getElementById('add-member-form'),
        messageModal: document.getElementById('message-modal'),
        modalMessage: document.getElementById('modal-message'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        successIdList: document.getElementById('success-id-list'),
        btnProceedDashboard: document.getElementById('btn-proceed-dashboard'),
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

    initializeAuth(ui, showMessage, goToStep, displayRegistrationSuccess);
    initializeDashboard(ui, showMessage);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            ui.loadingScreen.classList.remove('hidden');
            const success = await displayDashboard(user.uid, ui, showMessage);
            if (success) {
                ui.authScreen.classList.add('hidden');
                ui.appScreen.classList.remove('hidden');
            } else {
                ui.authScreen.classList.remove('hidden');
                ui.appScreen.classList.add('hidden');
            }
            ui.loadingScreen.classList.add('hidden');
        } else {
            ui.authScreen.classList.remove('hidden');
            ui.appScreen.classList.add('hidden');
            ui.loadingScreen.classList.add('hidden');
        }
    });

    ui.logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });
}

document.addEventListener('DOMContentLoaded', main);

