
const {onCall} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2/options");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

// Set the region for all functions in this file
setGlobalOptions({region: "asia-south1"});

// Initialize the Firebase Admin SDK
initializeApp();

/**
 * Verifies a member's existence based on Sabha ID and Aadhaar number.
 */
exports.verifyMemberById = onCall(async (request) => {
  const {sabhaId, aadhaar} = request.data;
  if (!sabhaId || !aadhaar || aadhaar.length !== 12) {
    return {success: false, message: "Invalid input provided."};
  }
  const db = getFirestore();
  const membersRef = db.collection("members");
  const snapshot = await membersRef
      .where("sabhaId", "==", sabhaId)
      .where("aadhaar", "==", aadhaar)
      .limit(1)
      .get();
  if (snapshot.empty) {
    return {
      success: false,
      message: "Details not found. Please check your Sabha ID and Aadhaar.",
    };
  }
  const memberDoc = snapshot.docs[0];
  const memberData = memberDoc.data();
  if (memberData.authUid) {
    return {
      success: false,
      message: "An online account already exists. Please use the Login page.",
    };
  }
  return {
    success: true,
    fullName: memberData.fullName,
    docId: memberDoc.id,
  };
});

/**
 * Finds a member's existence based on Full Name, Aadhaar, and Date of Birth.
 */
exports.findMemberByName = onCall(async (request) => {
  const {fullName, aadhaar, dob} = request.data;
  if (!fullName || !aadhaar || !dob || aadhaar.length !== 12) {
    return {success: false, message: "Invalid input provided."};
  }
  const db = getFirestore();
  const membersRef = db.collection("members");
  const snapshot = await membersRef
      .where("fullName", "==", fullName)
      .where("aadhaar", "==", aadhaar)
      .where("dob", "==", dob)
      .limit(1)
      .get();
  if (snapshot.empty) {
    return {
      success: false,
      message: "No profile found with those details.",
    };
  }
  const memberDoc = snapshot.docs[0];
  const memberData = memberDoc.data();
  if (memberData.authUid) {
    return {
      success: false,
      message: "An online account already exists. Please use the Login page.",
    };
  }
  return {
    success: true,
    fullName: memberData.fullName,
    sabhaId: memberData.sabhaId,
    docId: memberDoc.id,
  };
});


/**
 * Adds a new family member. If they already exist, links them to the
 * current user's family. Otherwise, creates a new member record.
 */
exports.linkOrCreateFamilyMember = onCall(async (request) => {
  // Use functions.https.HttpsError for better error handling on the client
  const functions = require("firebase-functions");
  const admin = require("firebase-admin");

  const {newMemberDetails, currentUserAuthUid} = request.data;

  // Basic validation
  if (!newMemberDetails || !currentUserAuthUid || !newMemberDetails.aadhaar) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid data provided.",
    );
  }

  const db = admin.firestore();
  const membersRef = db.collection("members");

  // Step 1: Search for an existing member with the same Aadhaar number
  const existingMemberQuery = await membersRef
      .where("aadhaar", "==", newMemberDetails.aadhaar)
      .limit(1)
      .get();

  // Step 2: If an existing member is found, link them
  if (!existingMemberQuery.empty) {
    const existingMemberDoc = existingMemberQuery.docs[0];
    const currentUserDoc = await membersRef.doc(currentUserAuthUid).get();
    if (!currentUserDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Current user not found.");
    }
    const familyId = currentUserDoc.data().familyId;

    // Update the existing member's document
    await existingMemberDoc.ref.update({
      familyId: familyId,
      role: newMemberDetails.role, // Set the role as defined by the current user
    });

    return {
      success: true,
      message: "Existing member found and linked to your family.",
    };
  } else {
    // Step 3: If no member is found, create a new one
    const currentUserDoc = await membersRef.doc(currentUserAuthUid).get();
    if (!currentUserDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Current user not found.");
    }
    const familyId = currentUserDoc.data().familyId;
    const counterRef = db.collection("counters").doc("memberCounter");

    let newSabhaId;
    await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const newId = counterDoc.exists ? counterDoc.data().currentId + 1 : 1;
      newSabhaId = String(newId).padStart(7, "0");
      transaction.set(counterRef, {currentId: newId}, {merge: true});
    });

    await membersRef.add({
      ...newMemberDetails,
      sabhaId: newSabhaId,
      familyId: familyId,
      registeredBy: currentUserAuthUid,
      createdAt: new Date(),
    });

    return {
      success: true,
      message: "New member successfully created and added to your family.",
    };
  }
});