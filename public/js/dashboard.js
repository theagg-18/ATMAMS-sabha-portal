// Version: 2.0.2
import { auth, db, storage, functions } from './firebase.js';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

let currentUserData = null; // Store current user's data for reuse

// This function will be called by main.js to set up all dashboard features
export function initializeDashboard(ui, showMessage) {
    const { 
        changePasswordForm, addFamilyMemberBtn, addMemberModal, 
        closeAddMemberModalBtn, cancelAddMemberBtn, addMemberForm,
        photoUploadInput, photoPreview, uploadPhotoBtn, photoPlaceholderText,
        newMemberRelation, addMemberFieldsContainer
    } = ui;

    let selectedFile = null;

    // --- EVENT LISTENERS ---

    photoUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                photoPreview.src = event.target.result;
                photoPreview.classList.remove('hidden');
                photoPlaceholderText.classList.add('hidden');
            };
            reader.readAsDataURL(file);
            uploadPhotoBtn.classList.remove('hidden');
        }
    });

    uploadPhotoBtn.addEventListener('click', async () => {
        if (!selectedFile) return showMessage("Please choose a file first.");
        const user = auth.currentUser;
        if (!user) return showMessage("You are not logged in.");

        ui.loadingScreen.classList.remove('hidden');
        try {
            const storageRef = ref(storage, `profile_images/${user.uid}`);
            await uploadBytes(storageRef, selectedFile);
            const photoURL = await getDownloadURL(storageRef);
            await updateDoc(doc(db, 'members', user.uid), { photoURL: photoURL });
            showMessage("Photo uploaded successfully!");
            uploadPhotoBtn.classList.add('hidden');
            await displayDashboard(user.uid, ui, showMessage);
        } catch (error) {
            console.error("Photo upload failed:", error);
            showMessage("Photo upload failed. File might be too large (max 5MB).");
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });

    addFamilyMemberBtn.addEventListener('click', () => {
        addMemberModal.classList.remove('hidden');
    });

    closeAddMemberModalBtn.addEventListener('click', () => {
        addMemberModal.classList.add('hidden');
        addMemberForm.reset();
        addMemberFieldsContainer.innerHTML = '';
    });

    cancelAddMemberBtn.addEventListener('click', () => {
        addMemberModal.classList.add('hidden');
        addMemberForm.reset();
        addMemberFieldsContainer.innerHTML = '';
    });

    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const retypeNewPassword = document.getElementById('retype-new-password').value;
        if (newPassword !== retypeNewPassword) return showMessage("New passwords do not match.");
        
        const user = auth.currentUser;
        if (!user) return showMessage("No user is currently logged in.");

        ui.loadingScreen.classList.remove('hidden');
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            showMessage("Password updated successfully!");
            changePasswordForm.reset();
        } catch (error) {
            let friendlyMessage = "Failed to change password.";
            if (error.code === 'auth/wrong-password') friendlyMessage = "The current password you entered is incorrect.";
            else if (error.code === 'auth/weak-password') friendlyMessage = "Your new password is too weak (must be at least 6 characters).";
            showMessage(friendlyMessage);
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });
    
    newMemberRelation.addEventListener('change', (e) => {
        const relation = e.target.value;
        addMemberFieldsContainer.innerHTML = ''; // Clear previous fields
        if (relation === "Spouse" || relation === "Brother" || relation === "Sister" || relation === "Father" || relation === "Mother") {
            addMemberFieldsContainer.innerHTML = `<p class="text-sm text-gray-600 mb-2">Enter the existing member's details to link them to your family.</p><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="block text-sm">Sabha ID</label><input type="text" name="linkSabhaId" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div><div><label class="block text-sm">Aadhaar</label><input type="number" name="linkAadhaar" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div></div>`;
        } else if (relation === "Child") {
            addMemberFieldsContainer.innerHTML = `<p class="text-sm text-gray-600 mb-2">Enter the new child's details to create their record.</p><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="block text-sm">Full Name</label><input type="text" name="newMemberFullName" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div><div><label class="block text-sm">Date of Birth</label><input type="date" name="newMemberDob" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div><div class="md:col-span-2"><label class="block text-sm">Aadhaar</label><input type="number" name="newMemberAadhaar" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div><div><label class="block text-sm">Education</label><input type="text" name="newMemberEducation" required class="w-full px-3 py-2 border border-gray-300 rounded-md"></div><div><label class="block text-sm">Blood Group</label><select name="newMemberBloodGroup" required class="w-full px-3 py-2 border border-gray-300 rounded-md"><option value="">Select</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option></select></div></div>`;
        }
    });

    addMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const relation = newMemberRelation.value;
        if (!relation) return showMessage("Please select a relation.");

        let memberDetails = { role: relation };
        if (relation === "Child") {
            memberDetails.fullName = addMemberForm.querySelector('input[name="newMemberFullName"]').value;
            memberDetails.aadhaar = addMemberForm.querySelector('input[name="newMemberAadhaar"]').value;
            memberDetails.dob = addMemberForm.querySelector('input[name="newMemberDob"]').value;
            memberDetails.education = addMemberForm.querySelector('input[name="newMemberEducation"]').value;
            memberDetails.bloodGroup = addMemberForm.querySelector('select[name="newMemberBloodGroup"]').value;
        } else {
            memberDetails.aadhaar = addMemberForm.querySelector('input[name="linkAadhaar"]').value;
            memberDetails.sabhaId = addMemberForm.querySelector('input[name="linkSabhaId"]').value;
        }
        
        const user = auth.currentUser;
        if (!user) return showMessage("You are not logged in.");
        
        ui.loadingScreen.classList.remove('hidden');
        try {
            const linkOrCreateMember = httpsCallable(functions, 'linkOrCreateFamilyMember');
            const result = await linkOrCreateMember({ newMemberDetails: memberDetails, currentUserAuthUid: user.uid });
            if (result.data.success) {
                showMessage(result.data.message);
                addMemberForm.reset();
                addMemberFieldsContainer.innerHTML = '';
                addMemberModal.classList.add('hidden');
                await displayDashboard(user.uid, ui, showMessage);
            } else {
                showMessage(result.data.message || "An unknown error occurred.");
            }
        } catch (error) {
            console.error("Failed to add family member:", error);
            showMessage("An error occurred: " + error.message);
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });
}

export async function displayDashboard(userId, ui, showMessage) {
    try {
        const userDocRef = doc(db, 'members', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) { signOut(auth); return false; }
        currentUserData = userDocSnap.data();
        
        ui.userWelcome.textContent = `Welcome, ${currentUserData.fullName.split(' ')[0]}!`;
        document.getElementById('id-card-name').textContent = currentUserData.fullName;
        document.getElementById('id-card-sabha-id').textContent = currentUserData.sabhaId;
        document.getElementById('id-card-dob').textContent = currentUserData.dob;
        
        const idCardPhoto = document.getElementById('id-card-photo');
        if (currentUserData.photoURL) {
            idCardPhoto.src = currentUserData.photoURL;
            idCardPhoto.classList.remove('hidden');
        } else { idCardPhoto.classList.add('hidden'); }

        const qrcodeContainer = document.getElementById('id-card-qrcode');
        qrcodeContainer.innerHTML = '';
        new QRCode(qrcodeContainer, { text: currentUserData.sabhaId, width: 64, height: 64, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });

        if (currentUserData.photoURL) {
            ui.photoPreview.src = currentUserData.photoURL;
            ui.photoPreview.classList.remove('hidden');
            ui.photoPlaceholderText.classList.add('hidden');
        } else {
            ui.photoPreview.src = '';
            ui.photoPreview.classList.add('hidden');
            ui.photoPlaceholderText.classList.remove('hidden');
        }

        await refreshFamilyTree(currentUserData.familyId, userId, ui.familyTreeContainer);
        return true;
    } catch (error) {
        console.error("Error displaying dashboard:", error);
        signOut(auth);
        return false;
    }
}

async function refreshFamilyTree(familyId, currentUserId, container) {
    const familyQuery = query(collection(db, "members"), where("familyId", "==", familyId)); 
    const querySnapshot = await getDocs(familyQuery); 
    container.innerHTML = ''; 
    let familyMembers = []; 
    querySnapshot.forEach((docSnap) => { 
        if (docSnap.id !== currentUserId) { 
            familyMembers.push(docSnap.data()); 
        } 
    });
    
    if (familyMembers.length > 0) { 
        familyMembers.sort((a, b) => (a.role || "").localeCompare(b.role || "")).forEach(member => { 
            const memberCard = document.createElement('div'); 
            memberCard.className = 'flex items-center justify-between p-3 bg-gray-100 rounded-lg'; 
            memberCard.innerHTML = `<div><p class="font-semibold">${member.fullName}</p><p class="text-sm text-gray-500">Sabha ID: ${member.sabhaId}</p></div><span class="text-sm font-medium bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">${member.role || 'Family'}</span>`; 
            container.appendChild(memberCard); 
        }); 
    } else { 
        container.innerHTML = '<p class="text-gray-500">No other family members have been registered.</p>'; 
    }
}