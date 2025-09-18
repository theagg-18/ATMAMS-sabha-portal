const firebaseConfig = {
    apiKey: "AIzaSyBsraiG11tJCu5CYRiQiqe3kaVJShh_cfI",
    authDomain: "atmams-sabhaid-system.firebaseapp.com",
    projectId: "atmams-sabhaid-system",
    storageBucket: "atmams-sabhaid-system.appspot.com",
    messagingSenderId: "187796742502",
    appId: "1:187796742502:web:f6f808cb9d555b67e6a8a7",
    measurementId: "G-0TV419DPH1"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, runTransaction, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-south1"); 

// --- UI Element References ---
const loadingScreen = document.getElementById('loading-screen');
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');

// Login and Reset Password
const authTabs = document.getElementById('auth-tabs');
const loginForm = document.getElementById('login-form');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const backToLoginBtn = document.getElementById('back-to-login-btn');

// Change Password
const changePasswordForm = document.getElementById('change-password-form');

// Registration
const registerContainer = document.getElementById('register-container');
const showLoginBtn = document.getElementById('show-login-btn');
const showRegisterBtn = document.getElementById('show-register-btn');
const steps = document.querySelectorAll('.form-step');
const btnHasId = document.getElementById('btn-has-id');
const btnNoId = document.getElementById('btn-no-id');
const btnSkipToRegister = document.getElementById('btn-skip-to-register');
const verifyIdForm = document.getElementById('verify-id-form');
const findIdForm = document.getElementById('find-id-form');
const createLoginForm = document.getElementById('create-login-form');
const registerForm = document.getElementById('register-form');

// Success and Dashboard
const successIdList = document.getElementById('success-id-list');
const btnProceedDashboard = document.getElementById('btn-proceed-dashboard');
const messageModal = document.getElementById('message-modal');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');

const showMessage = (message) => { modalMessage.textContent = message; messageModal.classList.remove('hidden'); };
modalCloseBtn.addEventListener('click', () => messageModal.classList.add('hidden'));

const goToStep = (stepId) => {
    steps.forEach(step => step.classList.remove('active'));
    document.getElementById(stepId).classList.add('active');
};

// --- NEW EVENT LISTENERS FOR PASSWORD MANAGEMENT ---

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

forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    loadingScreen.classList.remove('hidden');
    try {
        await sendPasswordResetEmail(auth, email);
        showMessage("Password reset link sent! Please check your email inbox (and spam folder).");
        backToLoginBtn.click();
    } catch (error) {
        console.error("Password reset failed:", error);
        showMessage(`Error: ${error.message}`);
    } finally {
        loadingScreen.classList.add('hidden');
    }
});

changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const retypeNewPassword = document.getElementById('retype-new-password').value;

    if (newPassword !== retypeNewPassword) {
        showMessage("New passwords do not match.");
        return;
    }
    
    const user = auth.currentUser;
    if (!user) {
        showMessage("No user is currently logged in.");
        return;
    }

    loadingScreen.classList.remove('hidden');
    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        // Re-authenticate the user to confirm their identity
        await reauthenticateWithCredential(user, credential);
        // If re-authentication is successful, update the password
        await updatePassword(user, newPassword);
        showMessage("Password updated successfully!");
        changePasswordForm.reset(); // Clear the form fields
    } catch (error) {
        console.error("Password change failed:", error);
        let friendlyMessage = "Failed to change password.";
        if (error.code === 'auth/wrong-password') {
            friendlyMessage = "The current password you entered is incorrect.";
        } else if (error.code === 'auth/weak-password') {
            friendlyMessage = "Your new password is too weak. It must be at least 6 characters long.";
        }
        showMessage(friendlyMessage);
    } finally {
        loadingScreen.classList.add('hidden');
    }
});


// --- EXISTING EVENT LISTENERS AND FUNCTIONS ---

btnHasId.addEventListener('click', () => goToStep('step-verify-with-id'));
btnNoId.addEventListener('click', () => goToStep('step-find-id'));
btnSkipToRegister.addEventListener('click', () => goToStep('step-full-registration'));
document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', () => goToStep('step-initial-question')));

btnProceedDashboard.addEventListener('click', async () => {
     if (auth.currentUser) {
        const userDocRef = doc(db, 'members', auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            await displayDashboard(userDocSnap.data());
            authScreen.classList.add('hidden');
            appScreen.classList.remove('hidden');
        } else {
            showMessage("Could not load dashboard. Please log in again.");
            signOut(auth);
        }
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, 'members', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            authScreen.classList.remove('hidden');
            appScreen.classList.add('hidden');
        }
    } else {
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
    loadingScreen.classList.add('hidden');
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loadingScreen.classList.remove('hidden');
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;
    try { 
        await signInWithEmailAndPassword(auth, email, password);
        const userDocRef = doc(db, 'members', auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
         if (userDocSnap.exists()) {
            await displayDashboard(userDocSnap.data());
            authScreen.classList.add('hidden');
            appScreen.classList.remove('hidden');
        } else {
            showMessage("Login successful, but your member data was not found. Please contact support.");
            await signOut(auth);
        }
    } 
    catch (error) { 
        let friendlyMessage = `Login Failed: ${error.message}`;
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            friendlyMessage = "Login Failed: The email or password you entered is incorrect.";
        }
        showMessage(friendlyMessage); 
    }
    finally { loadingScreen.classList.add('hidden'); }
});

verifyIdForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loadingScreen.classList.remove('hidden');
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
        loadingScreen.classList.add('hidden');
    }
});

findIdForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loadingScreen.classList.remove('hidden');
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
        loadingScreen.classList.add('hidden');
    }
});


// ... Rest of the functions (registerForm, displayDashboard, etc.) are unchanged ...
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (registerForm['register-password'].value !== registerForm['register-retype-password'].value) { showMessage("Passwords do not match."); return; }
    if (registerForm['register-aadhaar'].value !== registerForm['register-retype-aadhaar'].value) { showMessage("Aadhaar numbers do not match."); return; }
    loadingScreen.classList.remove('hidden');
    
    const mainApplicantEmail = registerForm.querySelector('input[name="email"]').value;
    const mainApplicantPassword = registerForm['register-password'].value;

    let userCredential;
    try {
        userCredential = await createUserWithEmailAndPassword(auth, mainApplicantEmail, mainApplicantPassword);
        const user = userCredential.user;

        let familyData = []; 
        const familyId = crypto.randomUUID();

        const mainApplicantData = {
            fullName: registerForm.querySelector('input[name="fullName"]').value,
            dob: registerForm.querySelector('input[name="dob"]').value,
            gender: registerForm.querySelector('select[name="gender"]').value,
            maritalStatus: document.getElementById('marital-status').value,
            dateOfMarriage: document.getElementById('marital-status').value === 'Married' ? registerForm.querySelector('input[name="dateOfMarriage"]').value : '',
            education: registerForm.querySelector('input[name="education"]').value,
            job: registerForm.querySelector('input[name="job"]').value,
            bloodGroup: registerForm.querySelector('select[name="bloodGroup"]').value,
            currentAddress: document.getElementById('current-address').value,
            permanentAddress: document.getElementById('permanent-address').value,
            aadhaar: registerForm.querySelector('input[name="aadhaar"]').value,
            email: mainApplicantEmail,
            phone: registerForm.querySelector('input[name="phone"]').value,
            role: 'Self'
        };
        familyData.push(mainApplicantData);

        if(document.getElementById('add-spouse-toggle').checked) { 
            familyData.push({ 
                fullName: document.getElementById('spouse-fullName').value, 
                aadhaar: document.getElementById('spouse-aadhaar').value, 
                email: document.getElementById('spouse-email').value, 
                phone: document.getElementById('spouse-phone').value, 
                dob: document.getElementById('spouse-dob').value, 
                education: document.getElementById('spouse-education').value,
                bloodGroup: document.getElementById('spouse-bloodGroup').value,
                role: 'Spouse' 
            }); 
        }
        document.querySelectorAll('.child-entry').forEach(c => { 
            familyData.push({ 
                fullName: c.querySelector('input[name="child-fullName"]').value, 
                aadhaar: c.querySelector('input[name="child-aadhaar"]').value, 
                dob: c.querySelector('input[name="child-dob"]').value, 
                education: c.querySelector('input[name="child-education"]').value,
                bloodGroup: c.querySelector('select[name="child-bloodGroup"]').value,
                role: 'Child' 
            }); 
        });
        if(document.getElementById('add-father-toggle').checked) { 
            familyData.push({ 
                fullName: document.getElementById('father-fullName').value, 
                aadhaar: document.getElementById('father-aadhaar').value, 
                email: document.getElementById('father-email').value, 
                phone: document.getElementById('father-phone').value, 
                dob: document.getElementById('father-dob').value, 
                education: document.getElementById('father-education').value,
                bloodGroup: document.getElementById('father-bloodGroup').value,
                role: 'Father' 
            }); 
        }
        if(document.getElementById('add-mother-toggle').checked) { 
            familyData.push({ 
                fullName: document.getElementById('mother-fullName').value, 
                aadhaar: document.getElementById('mother-aadhaar').value, 
                email: document.getElementById('mother-email').value, 
                phone: document.getElementById('mother-phone').value, 
                dob: document.getElementById('mother-dob').value, 
                education: document.getElementById('mother-education').value,
                bloodGroup: document.getElementById('mother-bloodGroup').value,
                role: 'Mother' 
            }); 
        }
        
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
            await deleteUser(userCredential.user).catch(deleteErr => {
                console.error("Failed to delete orphaned auth user:", deleteErr);
            });
        }
        
        let friendlyMessage = `Registration Failed: ${error.message}`;
        if (error.code === 'auth/email-already-in-use') {
            friendlyMessage = "This email is already registered. Please log in instead.";
        } else if (error.message.includes("permission-denied") || error.message.includes("Permissions")) {
            friendlyMessage = "Registration Failed: Could not save data due to a permissions issue. Please contact the administrator.";
        }
        showMessage(friendlyMessage);
    } finally {
        loadingScreen.classList.add('hidden');
    }
});

async function displayDashboard(userData) {
    document.getElementById('user-welcome').textContent = `Welcome, ${userData.fullName.split(' ')[0]}!`; 
    document.getElementById('id-card-name').textContent = userData.fullName; 
    document.getElementById('id-card-sabha-id').textContent = userData.sabhaId; 
    document.getElementById('id-card-email').textContent = userData.email || 'Not set'; 
    document.getElementById('id-card-phone').textContent = userData.phone || 'Not set';
    
    const familyQuery = query(collection(db, "members"), where("familyId", "==", userData.familyId)); 
    const querySnapshot = await getDocs(familyQuery); 
    const familyContainer = document.getElementById('family-tree-container'); 
    familyContainer.innerHTML = ''; 
    let familyMembers = []; 
    querySnapshot.forEach((doc) => { 
        if (doc.id !== auth.currentUser.uid) { 
            familyMembers.push(doc.data()); 
        } 
    });
    
    if (familyMembers.length > 0) { 
        familyMembers.sort((a, b) => a.role.localeCompare(b.role)).forEach(member => { 
            const memberCard = document.createElement('div'); 
            memberCard.className = 'flex items-center justify-between p-3 bg-gray-100 rounded-lg'; 
            memberCard.innerHTML = `<div><p class="font-semibold">${member.fullName}</p><p class="text-sm text-gray-500">Sabha ID: ${member.sabhaId}</p></div><span class="text-sm font-medium bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">${member.role}</span>`; 
            familyContainer.appendChild(memberCard); 
        }); 
    } else { 
        familyContainer.innerHTML = '<p class="text-gray-500">No other family members have been registered.</p>'; 
    }
}

function displayRegistrationSuccess(members) { 
    successIdList.innerHTML = ''; 
    members.forEach(member => { 
        const listItem = document.createElement('div'); 
        listItem.className = 'flex items-center justify-between p-3 bg-white rounded-md border'; 
        listItem.innerHTML = `<div><p class="font-semibold text-gray-800">${member.fullName}</p><p class="text-sm text-gray-500">${member.sabhaId}</p></div><button class="download-new-id-btn text-sm bg-gray-700 text-white px-3 py-1.5 rounded-md hover:bg-gray-800" data-name="${member.fullName}" data-id="${member.sabhaId}" data-email="${member.email || ''}" data-phone="${member.phone || ''}">Download ID</button>`; 
        successIdList.appendChild(listItem); 
    }); 
    goToStep('step-registration-success'); 
}

async function downloadGeneratedId(name, sabhaId, email, phone) { 
    const templateCard = document.getElementById('template-card-content'); 
    document.getElementById('template-card-name').textContent = name; 
    document.getElementById('template-card-sabha-id').textContent = sabhaId; 
    document.getElementById('template-card-email').textContent = email || 'N/A'; 
    document.getElementById('template-card-phone').textContent = phone || 'N/A'; 
    try { 
        const canvas = await html2canvas(templateCard, { scale: 2 }); 
        const link = document.createElement('a'); 
        link.download = `Sabha_ID_${name.replace(/\s+/g, '_')}_${sabhaId}.png`; 
        link.href = canvas.toDataURL('image/png'); 
        link.click(); 
    } catch (error) { 
        console.error('Error generating ID card:', error); 
        showMessage('Could not generate ID card image.'); 
    } 
}

successIdList.addEventListener('click', (e) => { 
    if (e.target.classList.contains('download-new-id-btn')) { 
        const button = e.target; 
        downloadGeneratedId(button.dataset.name, button.dataset.id, button.dataset.email, button.dataset.phone); 
    } 
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('download-id-btn').addEventListener('click', () => { 
    html2canvas(document.getElementById('digital-id-card'), { scale: 2 }).then(canvas => { 
        const link = document.createElement('a'); 
        link.download = `Sabha_ID_${document.getElementById('id-card-name').textContent.replace(/\s+/g, '_')}.png`; 
        link.href = canvas.toDataURL('image/png'); 
        link.click(); 
    }); 
});

const createAdultMemberFields = (role) => `
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label><input type="text" id="${role}-fullName" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label><input type="date" id="${role}-dob" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
    <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">Aadhaar Number</label><input type="number" id="${role}-aadhaar" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Education</label><input type="text" id="${role}-education" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Blood Group</label><select id="${role}-bloodGroup" required class="w-full px-3 py-2 border border-gray-300 rounded-md"><option value="">Select</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option></select></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" id="${role}-email" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label><input type="tel" id="${role}-phone" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
`;

const addChildBtn = document.getElementById('add-child-btn');
addChildBtn.addEventListener('click', () => { 
    const childrenContainer = document.getElementById('children-container'); 
    if (childrenContainer.querySelectorAll('.child-entry').length >= 10) { 
        showMessage('You can add a maximum of 10 children.'); 
        return; 
    } 
    const childId = `child-${Date.now()}`; 
    const childDiv = document.createElement('div'); 
    childDiv.className = 'child-entry border p-3 rounded-md relative bg-gray-50'; 
    childDiv.id = childId; 
    childDiv.innerHTML = `
        <button type="button" onclick="document.getElementById('${childId}').remove()" class="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center hover:bg-red-600">X</button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Child's Full Name</label><input type="text" name="child-fullName" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Child's Date of Birth</label><input type="date" name="child-dob" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
            <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">Child's Aadhaar Number</label><input type="number" name="child-aadhaar" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Education</label><input type="text" name="child-education" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Blood Group</label><select name="child-bloodGroup" required class="w-full px-3 py-2 border border-gray-300 rounded-md"><option value="">Select</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option></select></div>
        </div>`; 
    childrenContainer.appendChild(childDiv); 
});
        
const addSpouseToggle = document.getElementById('add-spouse-toggle'); addSpouseToggle.addEventListener('change', () => { const c = document.getElementById('spouse-details'); if (addSpouseToggle.checked) { c.classList.remove('hidden'); c.innerHTML = createAdultMemberFields('spouse'); } else { c.classList.add('hidden'); c.innerHTML = ''; } });
const addFatherToggle = document.getElementById('add-father-toggle'); addFatherToggle.addEventListener('change', () => { const c = document.getElementById('father-details'); if (addFatherToggle.checked) { c.classList.remove('hidden'); c.innerHTML = createAdultMemberFields('father'); } else { c.classList.add('hidden'); c.innerHTML = ''; } });
const addMotherToggle = document.getElementById('add-mother-toggle'); addMotherToggle.addEventListener('change', () => { const c = document.getElementById('mother-details'); if (addMotherToggle.checked) { c.classList.remove('hidden'); c.innerHTML = createAdultMemberFields('mother'); } else { c.classList.add('hidden'); c.innerHTML = ''; } });

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

createLoginForm.addEventListener('submit', async (e) => { e.preventDefault(); if (createLoginForm['create-password'].value !== createLoginForm['create-retype-password'].value) { showMessage("Passwords do not match."); return; } loadingScreen.classList.remove('hidden'); const email = createLoginForm['create-email'].value; const phone = createLoginForm['create-phone'].value; const password = createLoginForm['create-password'].value; const docId = createLoginForm['member-doc-id'].value; try { const userCredential = await createUserWithEmailAndPassword(auth, email, password); const user = userCredential.user; await updateDoc(doc(db, "members", docId), { authUid: user.uid, email: email, phone: phone }); showMessage("Account created! You are now logged in."); btnProceedDashboard.click(); } catch (error) { showMessage(`Account creation failed: ${error.message}`); } finally { loadingScreen.classList.add('hidden'); } });

const maritalStatusSelect = document.getElementById('marital-status');
const domContainer = document.getElementById('date-of-marriage-container');
maritalStatusSelect.addEventListener('change', (e) => {
    if (e.target.value === 'Married') {
        domContainer.classList.remove('hidden');
    } else {
        domContainer.classList.add('hidden');
        domContainer.querySelector('input').value = '';
    }
});

const sameAsCurrentCheckbox = document.getElementById('same-as-current');
const currentAddressTextarea = document.getElementById('current-address');
const permanentAddressTextarea = document.getElementById('permanent-address');
sameAsCurrentCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        permanentAddressTextarea.value = currentAddressTextarea.value;
        permanentAddressTextarea.readOnly = true;
    } else {
        permanentAddressTextarea.value = '';
        permanentAddressTextarea.readOnly = false;
    }
});
currentAddressTextarea.addEventListener('input', () => {
    if (sameAsCurrentCheckbox.checked) {
        permanentAddressTextarea.value = currentAddressTextarea.value;
    }
});