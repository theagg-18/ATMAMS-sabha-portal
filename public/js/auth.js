// This file handles all logic for authentication: login, registration, password reset, etc.

import { auth, db, functions } from './firebase.js';
// THIS IS THE CRITICAL FIX: I moved 'updateDoc' from the auth import to the firestore import below.
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, collection, runTransaction, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// This function will be called by main.js to set up all event listeners
export function initializeAuth(ui, showMessage, goToStep, displayRegistrationSuccess) {
    const { 
        loginForm, forgotPasswordForm, forgotPasswordLink, backToLoginBtn, 
        registerContainer, showLoginBtn, showRegisterBtn, authTabs, 
        verifyIdForm, findIdForm, createLoginForm, registerForm,
        btnHasId, btnNoId, btnSkipToRegister
    } = ui;

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

    btnHasId.addEventListener('click', () => goToStep('step-verify-with-id'));
    btnNoId.addEventListener('click', () => goToStep('step-find-id'));
    btnSkipToRegister.addEventListener('click', () => goToStep('step-full-registration'));
    document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', () => goToStep('step-initial-question')));

    // --- Form Submission Logic ---
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;
        ui.loadingScreen.classList.remove('hidden');
        signInWithEmailAndPassword(auth, email, password)
            .catch(error => {
                let friendlyMessage = `Login Failed: ${error.message}`;
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    friendlyMessage = "Login Failed: The email or password you entered is incorrect.";
                }
                showMessage(friendlyMessage);
            })
            .finally(() => {
                ui.loadingScreen.classList.add('hidden');
            });
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

    verifyIdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        ui.loadingScreen.classList.remove('hidden');
        try {
            const verifyMemberById = httpsCallable(functions, 'verifyMemberById');
            const result = await verifyMemberById({ 
                sabhaId: document.getElementById('verify-sabha-id').value.trim(),
                aadhaar: document.getElementById('verify-aadhaar').value
            });

            if (result.data.success) {
                document.getElementById('verified-member-name').textContent = result.data.fullName;
                document.getElementById('member-doc-id').value = result.data.docId;
                goToStep('step-create-login');
            } else {
                showMessage(result.data.message);
            }
        } catch (error) {
            console.error("Verification function failed:", error);
            showMessage("An error occurred during verification. Please try again later.");
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });

    findIdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        ui.loadingScreen.classList.remove('hidden');
        try {
            const findMemberByName = httpsCallable(functions, 'findMemberByName');
            const result = await findMemberByName({
                fullName: document.getElementById('find-fullName').value.trim(),
                aadhaar: document.getElementById('find-aadhaar').value,
                dob: document.getElementById('find-dob').value
            });
            
            if (result.data.success) {
                document.getElementById('verified-member-name').textContent = `${result.data.fullName} (ID: ${result.data.sabhaId})`;
                document.getElementById('member-doc-id').value = result.data.docId;
                goToStep('step-create-login');
            } else {
                if (result.data.message === "No profile found with those details.") {
                    showMessage(result.data.message + " Please proceed with a new registration.");
                    goToStep('step-full-registration');
                } else {
                    showMessage(result.data.message);
                }
            }
        } catch (error) {
            console.error("Find profile function failed:", error);
            showMessage("An error occurred while searching. Please try again later.");
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });

    createLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (createLoginForm['create-password'].value !== createLoginForm['create-retype-password'].value) {
            showMessage("Passwords do not match.");
            return;
        }
        ui.loadingScreen.classList.remove('hidden');
        const email = createLoginForm['create-email'].value;
        const phone = createLoginForm['create-phone'].value;
        const password = createLoginForm['create-password'].value;
        const docId = createLoginForm['member-doc-id'].value;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateDoc(doc(db, "members", docId), { authUid: userCredential.user.uid, email: email, phone: phone });
            // onAuthStateChanged will handle the redirect to the dashboard
        } catch (error) {
            showMessage(`Account creation failed: ${error.message}`);
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (registerForm['register-password'].value !== registerForm['register-retype-password'].value) { showMessage("Passwords do not match."); return; }
        if (registerForm['register-aadhaar'].value !== registerForm['register-retype-aadhaar'].value) { showMessage("Aadhaar numbers do not match."); return; }
        ui.loadingScreen.classList.remove('hidden');
        
        const mainApplicantEmail = registerForm.querySelector('input[name="email"]').value;
        const mainApplicantPassword = registerForm['register-password'].value;

        let userCredential;
        try {
            userCredential = await createUserWithEmailAndPassword(auth, mainApplicantEmail, mainApplicantPassword);
            const user = userCredential.user;

            let familyData = []; 
            const familyId = crypto.randomUUID();
            const mainApplicantData = { fullName: registerForm.querySelector('input[name="fullName"]').value, dob: registerForm.querySelector('input[name="dob"]').value, gender: registerForm.querySelector('select[name="gender"]').value, maritalStatus: document.getElementById('marital-status').value, dateOfMarriage: document.getElementById('marital-status').value === 'Married' ? registerForm.querySelector('input[name="dateOfMarriage"]').value : '', education: registerForm.querySelector('input[name="education"]').value, job: registerForm.querySelector('input[name="job"]').value, bloodGroup: registerForm.querySelector('select[name="bloodGroup"]').value, currentAddress: document.getElementById('current-address').value, permanentAddress: document.getElementById('permanent-address').value, aadhaar: registerForm.querySelector('input[name="aadhaar"]').value, email: mainApplicantEmail, phone: registerForm.querySelector('input[name="phone"]').value, role: 'Self' };
            familyData.push(mainApplicantData);
            if(document.getElementById('add-spouse-toggle').checked) { familyData.push({ fullName: document.getElementById('spouse-fullName').value, aadhaar: document.getElementById('spouse-aadhaar').value, email: document.getElementById('spouse-email').value, phone: document.getElementById('spouse-phone').value, dob: document.getElementById('spouse-dob').value, education: document.getElementById('spouse-education').value, bloodGroup: document.getElementById('spouse-bloodGroup').value, role: 'Spouse' }); }
            document.querySelectorAll('.child-entry').forEach(c => { familyData.push({ fullName: c.querySelector('input[name="child-fullName"]').value, aadhaar: c.querySelector('input[name="child-aadhaar"]').value, dob: c.querySelector('input[name="child-dob"]').value, education: c.querySelector('input[name="child-education"]').value, bloodGroup: c.querySelector('select[name="child-bloodGroup"]').value, role: 'Child' }); });
            if(document.getElementById('add-father-toggle').checked) { familyData.push({ fullName: document.getElementById('father-fullName').value, aadhaar: document.getElementById('father-aadhaar').value, email: document.getElementById('father-email').value, phone: document.getElementById('father-phone').value, dob: document.getElementById('father-dob').value, education: document.getElementById('father-education').value, bloodGroup: document.getElementById('father-bloodGroup').value, role: 'Father' }); }
            if(document.getElementById('add-mother-toggle').checked) { familyData.push({ fullName: document.getElementById('mother-fullName').value, aadhaar: document.getElementById('mother-aadhaar').value, email: document.getElementById('mother-email').value, phone: document.getElementById('mother-phone').value, dob: document.getElementById('mother-dob').value, education: document.getElementById('mother-education').value, bloodGroup: document.getElementById('mother-bloodGroup').value, role: 'Mother' }); }
            for (const member of familyData) { if (!member.fullName || !member.aadhaar || !member.dob) { throw new Error("Full Name, Aadhaar, and DOB are required for all family members."); } if (member.aadhaar.length !== 12) { throw new Error(`Aadhaar for ${member.fullName} must be 12 digits.`); } }
            
            let newlyRegisteredMembers = [];
            await runTransaction(db, async (transaction) => {
                const counterRef = doc(db, 'counters', 'memberCounter');
                const counterDoc = await transaction.get(counterRef);
                let newId = counterDoc.exists() ? counterDoc.data().currentId + 1 : 1;
                for (let i = 0; i < familyData.length; i++) {
                    const member = familyData[i];
                    const sabhaId = String(newId + i).padStart(7, '0');
                    let docData = { ...member, sabhaId: sabhaId, familyId: familyId, registeredBy: user.uid, createdAt: new Date() };
                    let memberDocRef;
                    if (member.role === 'Self') {
                        memberDocRef = doc(db, 'members', user.uid);
                        docData.authUid = user.uid;
                    } else {
                        memberDocRef = doc(collection(db, 'members'));
                    }
                    transaction.set(memberDocRef, docData);
                    newlyRegisteredMembers.push(docData);
                }
                if (counterDoc.exists()) { transaction.update(counterRef, { currentId: newId + familyData.length - 1 }); } else { transaction.set(counterRef, { currentId: familyData.length }); }
            });
            displayRegistrationSuccess(newlyRegisteredMembers);
        } catch (error) {
            if (userCredential) {
                await deleteUser(userCredential.user).catch(deleteErr => console.error("Failed to delete orphaned auth user:", deleteErr));
            }
            let friendlyMessage = `Registration Failed: ${error.message}`;
            if (error.code === 'auth/email-already-in-use') { friendlyMessage = "This email is already registered. Please log in instead."; } 
            else if (error.message.includes("permission-denied")) { friendlyMessage = "Registration Failed: Permissions error. Please contact the administrator."; }
            showMessage(friendlyMessage);
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });

}