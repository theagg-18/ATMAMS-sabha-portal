const { onCall } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize the Firebase Admin SDK
initializeApp();

/**
 * Verifies a member's existence based on Sabha ID and Aadhaar number.
 * This function is callable from the client-side application.
 */
exports.verifyMemberById = onCall(async (request) => {
  const { sabhaId, aadhaar } = request.data;

  // Basic validation on the input
  if (!sabhaId || !aadhaar || aadhaar.length !== 12) {
    return { success: false, message: "Invalid input provided." };
  }

  const db = getFirestore();
  const membersRef = db.collection("members");

  // Query the database to find a matching member
  const snapshot = await membersRef
    .where("sabhaId", "==", sabhaId)
    .where("aadhaar", "==", aadhaar)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { success: false, message: "Details not found. Please check your Sabha ID and Aadhaar number." };
  }

  const memberDoc = snapshot.docs[0];
  const memberData = memberDoc.data();

  // Check if the member already has an online account
  if (memberData.authUid) {
    return { success: false, message: "An online account already exists for this member. Please use the Login page." };
  }

  // Return success with the necessary (non-sensitive) data
  return {
    success: true,
    fullName: memberData.fullName,
    docId: memberDoc.id,
  };
});

/**
 * Finds a member's existence based on Full Name, Aadhaar, and Date of Birth.
 * This function is callable from the client-side application.
 */
exports.findMemberByName = onCall(async (request) => {
    const { fullName, aadhaar, dob } = request.data;

    // Basic validation on the input
    if (!fullName || !aadhaar || !dob || aadhaar.length !== 12) {
        return { success: false, message: "Invalid input provided." };
    }

    const db = getFirestore();
    const membersRef = db.collection("members");

    // Query the database
    const snapshot = await membersRef
        .where("fullName", "==", fullName)
        .where("aadhaar", "==", aadhaar)
        .where("dob", "==", dob)
        .limit(1)
        .get();

    if (snapshot.empty) {
        return { success: false, message: "No profile found with those details." };
    }

    const memberDoc = snapshot.docs[0];
    const memberData = memberDoc.data();

    if (memberData.authUid) {
        return { success: false, message: "An online account already exists for this member. Please use the Login page." };
    }

    return {
        success: true,
        fullName: memberData.fullName,
        sabhaId: memberData.sabhaId,
        docId: memberDoc.id,
    };
});
