// Version: 2.0.2 - Final Verified
// This file handles all logic for authentication: login, registration, password reset, etc.

import { auth, db, functions } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser, sendPasswordResetEmail, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, collection, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

export function initializeAuth(ui, showMessage, goToStep, displayRegistrationSuccess) {
    const { 
        loginForm, forgotPasswordForm, forgotPasswordLink, backToLoginBtn, 
        registerContainer, showLoginBtn, showRegisterBtn, authTabs, 
        verifyIdForm, findIdForm, createLoginForm, registerForm,
        btnHasId, btnNoId, btnSkipToRegister,
        addSpouseToggle, spouseDetails, 
        linkFatherToggle, fatherLinkDetails, linkMotherToggle, motherLinkDetails
    } = ui;

    const accountFieldsHTML = `
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" name="email" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label><input type="tel" name="phone" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" name="password" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Retype Password</label><input type="password" name="retype-password" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>`;

    document.querySelectorAll('input[name="primaryAccountHolder"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('[id^="account-fields-"]').forEach(c => {
                c.innerHTML = '';
                c.classList.add('hidden');
            });
            const targetContainer = document.getElementById(`account-fields-${e.target.value}`);
            if (targetContainer) {
                targetContainer.innerHTML = accountFieldsHTML;
                targetContainer.classList.remove('hidden');
            }
        });
    });
    document.querySelector('input[name="primaryAccountHolder"]:checked').dispatchEvent(new Event('change'));

    const adultFieldsHTML = (role) => `
        <div><label class="block text-sm font-medium">Full Name</label><input type="text" name="${role}_fullName" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
        <div><label class="block text-sm font-medium">Date of Birth</label><input type="date" name="${role}_dob" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
        <div><label class="block text-sm font-medium">Gender</label><select name="${role}_gender" required class="w-full px-3 py-2 border border-gray-300 rounded-md"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
        <div><label class="block text-sm font-medium">Aadhaar</label><input type="number" name="${role}_aadhaar" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>`;

    addSpouseToggle.addEventListener('change', (e) => {
        spouseDetails.classList.toggle('hidden', !e.target.checked);
        spouseDetails.innerHTML = e.target.checked ? adultFieldsHTML('Spouse') : '';
    });
    linkFatherToggle.addEventListener('change', (e) => fatherLinkDetails.classList.toggle('hidden', !e.target.checked));
    linkMotherToggle.addEventListener('change', (e) => motherLinkDetails.classList.toggle('hidden', !e.target.checked));

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
        goToStep('step-full-registration'); 
        showRegisterBtn.classList.add('border-blue-600', 'text-blue-600'); 
        showLoginBtn.classList.remove('border-blue-600', 'text-blue-600'); 
    });

    btnHasId.addEventListener('click', () => goToStep('step-verify-with-id'));
    btnNoId.addEventListener('click', () => goToStep('step-find-id'));
    btnSkipToRegister.addEventListener('click', () => goToStep('step-full-registration'));
    document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', () => goToStep('step-initial-question')));

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
        } catch (error) {
            showMessage(`Account creation failed: ${error.message}`);
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const primaryHolderType = registerForm.querySelector('input[name="primaryAccountHolder"]:checked').value;
        const accountContainer = document.getElementById(`account-fields-${primaryHolderType}`);
        if (!accountContainer || !accountContainer.querySelector('input[name="password"]')) {
            return showMessage("Please select an Account Holder and fill in their details.");
        }
        const password = accountContainer.querySelector('input[name="password"]').value;
        const retypePassword = accountContainer.querySelector('input[name="retype-password"]').value;
        if (password !== retypePassword) return showMessage("Passwords do not match.");
        
        ui.loadingScreen.classList.remove('hidden');
        const email = accountContainer.querySelector('input[name="email"]').value;
        let userCredential;

        try {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const familyId = crypto.randomUUID();
            let familyData = {};

            const getMemberData = (role) => ({
                fullName: registerForm.querySelector(`input[name="${role}_fullName"]`).value,
                dob: registerForm.querySelector(`input[name="${role}_dob"]`).value,
                gender: registerForm.querySelector(`select[name="${role}_gender"]`).value,
                aadhaar: registerForm.querySelector(`input[name="${role}_aadhaar"]`).value,
            });

            familyData.Self = getMemberData('Self');
            if (addSpouseToggle.checked) familyData.Spouse = getMemberData('Spouse');
            
            familyData.Self.fatherName = registerForm.querySelector('input[name="fatherName"]').value;
            familyData.Self.motherName = registerForm.querySelector('input[name="motherName"]').value;
            
            familyData[primaryHolderType].email = email;
            familyData[primaryHolderType].phone = accountContainer.querySelector('input[name="phone"]').value;

            let newlyRegisteredMembers = [];
            await runTransaction(db, async (transaction) => {
                const counterRef = doc(db, 'counters', 'memberCounter');
                const counterDoc = await transaction.get(counterRef);
                let newId = counterDoc.exists() ? counterDoc.data().currentId + 1 : 1;
                
                for (const role in familyData) {
                    const member = familyData[role];
                    const sabhaId = String(newId++).padStart(7, '0');
                    let docData = { ...member, sabhaId, role, familyId, registeredBy: user.uid, createdAt: new Date() };
                    
                    let memberDocRef;
                    if (role === primaryHolderType) {
                        memberDocRef = doc(db, 'members', user.uid);
                        docData.authUid = user.uid;
                        if (linkFatherToggle.checked) {
                            docData.fatherLinkingSabhaId = registerForm.querySelector('input[name="fatherSabhaId"]').value;
                            docData.fatherLinkingAadhaar = registerForm.querySelector('input[name="fatherAadhaar"]').value;
                        }
                        if (linkMotherToggle.checked) {
                            docData.motherLinkingSabhaId = registerForm.querySelector('input[name="motherSabhaId"]').value;
                            docData.motherLinkingAadhaar = registerForm.querySelector('input[name="motherAadhaar"]').value;
                        }
                    } else {
                        memberDocRef = doc(collection(db, 'members'));
                    }
                    transaction.set(memberDocRef, docData);
                    newlyRegisteredMembers.push(docData);
                }
                transaction.set(counterRef, { currentId: newId - 1 });
            });
            displayRegistrationSuccess(newlyRegisteredMembers);
        } catch (error) {
            if (userCredential) await deleteUser(userCredential.user).catch(err => console.error("Orphaned user cleanup failed", err));
            showMessage(`Registration Failed: ${error.message}`);
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });
}