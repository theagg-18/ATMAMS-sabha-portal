// This file handles all logic for the logged-in user dashboard.
import { auth, db } from './firebase.js';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUserData = null; // Store current user's data for reuse

// This function will be called by main.js to set up all dashboard features
export function initializeDashboard(ui, showMessage) {
    const { changePasswordForm, addFamilyMemberBtn, addMemberModal, closeAddMemberModalBtn, cancelAddMemberBtn, addMemberForm } = ui;

    // --- Event Listeners ---
    addFamilyMemberBtn.addEventListener('click', () => {
        addMemberModal.classList.remove('hidden');
    });

    closeAddMemberModalBtn.addEventListener('click', () => {
        addMemberModal.classList.add('hidden');
        addMemberForm.reset();
    });

    cancelAddMemberBtn.addEventListener('click', () => {
        addMemberModal.classList.add('hidden');
        addMemberForm.reset();
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

        ui.loadingScreen.classList.remove('hidden');
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            showMessage("Password updated successfully!");
            changePasswordForm.reset();
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
            ui.loadingScreen.classList.add('hidden');
        }
    });

    addMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUserData || !currentUserData.familyId) {
            showMessage("Could not identify current family. Please refresh.");
            return;
        }

        const newMember = {
            fullName: addMemberForm.querySelector('input[name="newMemberFullName"]').value,
            role: addMemberForm.querySelector('select[name="newMemberRelation"]').value,
            aadhaar: addMemberForm.querySelector('input[name="newMemberAadhaar"]').value,
            dob: addMemberForm.querySelector('input[name="newMemberDob"]').value,
            education: addMemberForm.querySelector('input[name="newMemberEducation"]').value,
            bloodGroup: addMemberForm.querySelector('select[name="newMemberBloodGroup"]').value,
        };

        if (!newMember.fullName || !newMember.role || !newMember.aadhaar || !newMember.dob) {
            showMessage("Please fill out all required fields.");
            return;
        }
        if (newMember.aadhaar.length !== 12) {
            showMessage("Aadhaar number must be 12 digits.");
            return;
        }

        ui.loadingScreen.classList.remove('hidden');
        try {
            await runTransaction(db, async (transaction) => {
                const counterRef = doc(db, 'counters', 'memberCounter');
                const counterDoc = await transaction.get(counterRef);
                let newId = counterDoc.exists() ? counterDoc.data().currentId + 1 : 1;
                const sabhaId = String(newId).padStart(7, '0');

                const newMemberRef = doc(collection(db, 'members'));
                transaction.set(newMemberRef, {
                    ...newMember,
                    sabhaId: sabhaId,
                    familyId: currentUserData.familyId,
                    registeredBy: currentUserData.authUid,
                    createdAt: new Date(),
                });
                transaction.update(counterRef, { currentId: newId });
            });
            showMessage("Family member added successfully!");
            addMemberForm.reset();
            addMemberModal.classList.add('hidden');
            await displayDashboard(currentUserData.authUid, ui, showMessage); // Refresh the dashboard
        } catch (error) {
            console.error("Failed to add family member:", error);
            showMessage("Error adding family member. Please try again.");
        } finally {
            ui.loadingScreen.classList.add('hidden');
        }
    });
}

// Fetches all data and populates the dashboard
export async function displayDashboard(userId, ui, showMessage) {
    try {
        const userDocRef = doc(db, 'members', userId);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            showMessage("Could not find your member data. Please log out and log in again.");
            signOut(auth);
            return false; // Indicate failure
        }
        currentUserData = userDocSnap.data();

        ui.userWelcome.textContent = `Welcome, ${currentUserData.fullName.split(' ')[0]}!`;
        // Populate ID card
        document.getElementById('id-card-name').textContent = currentUserData.fullName;
        document.getElementById('id-card-sabha-id').textContent = currentUserData.sabhaId;
        document.getElementById('id-card-email').textContent = currentUserData.email || 'Not set';
        document.getElementById('id-card-phone').textContent = currentUserData.phone || 'Not set';

        await refreshFamilyTree(currentUserData.familyId, userId, ui.familyTreeContainer);
        return true; // Indicate success
    } catch (error) {
        console.error("Error displaying dashboard:", error);
        showMessage("An error occurred while loading your dashboard.");
        signOut(auth);
        return false; // Indicate failure
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
        familyMembers.sort((a, b) => a.role.localeCompare(b.role)).forEach(member => { 
            const memberCard = document.createElement('div'); 
            memberCard.className = 'flex items-center justify-between p-3 bg-gray-100 rounded-lg'; 
            memberCard.innerHTML = `<div><p class="font-semibold">${member.fullName}</p><p class="text-sm text-gray-500">Sabha ID: ${member.sabhaId}</p></div><span class="text-sm font-medium bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">${member.role}</span>`; 
            container.appendChild(memberCard); 
        }); 
    } else { 
        container.innerHTML = '<p class="text-gray-500">No other family members have been registered.</p>'; 
    }
}

