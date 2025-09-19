// Version: 2.0.1
const {onCall} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2/options");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

// Set the region for all functions in this file
setGlobalOptions({region: "asia-south1"});
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
 * Adds a new family member. If they already exist, links them.
 */
exports.linkOrCreateFamilyMember = onCall(async (request) => {
  const functions = require("firebase-functions");
  const admin = require("firebase-admin");
  const {newMemberDetails, currentUserAuthUid} = request.data;

  if (!newMemberDetails || !currentUserAuthUid) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid data.");
  }

  const db = admin.firestore();
  const membersRef = db.collection("members");
  const currentUserRef = membersRef.doc(currentUserAuthUid);
  const currentUserDoc = await currentUserRef.get();

  if (!currentUserDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Current user not found.");
  }
  const currentUserData = currentUserDoc.data();
  const currentUserFamilyId = currentUserData.familyId;

  let existingMemberQuery;
  if (newMemberDetails.aadhaar) {
    existingMemberQuery = await membersRef.where("aadhaar", "==", newMemberDetails.aadhaar).limit(1).get();
  } else if (newMemberDetails.sabhaId) {
    existingMemberQuery = await membersRef.where("sabhaId", "==", newMemberDetails.sabhaId).limit(1).get();
  }

  if (existingMemberQuery && !existingMemberQuery.empty) {
    const existingMemberDoc = existingMemberQuery.docs[0];
    const existingMemberRef = existingMemberDoc.ref;
    const existingMemberFamilyId = existingMemberDoc.data().familyId;
    const batch = db.batch();
    const relation = newMemberDetails.role;

    if (relation === "Spouse") {
      batch.update(currentUserRef, {spouseId: existingMemberDoc.id});
      batch.update(existingMemberRef, {spouseId: currentUserAuthUid});
    } else if (relation === "Father") {
      batch.update(currentUserRef, {fatherId: existingMemberDoc.id, fatherName: existingMemberDoc.data().fullName});
      batch.update(existingMemberRef, {childrenIds: FieldValue.arrayUnion(currentUserAuthUid)});
    } else if (relation === "Mother") {
      batch.update(currentUserRef, {motherId: existingMemberDoc.id, motherName: existingMemberDoc.data().fullName});
      batch.update(existingMemberRef, {childrenIds: FieldValue.arrayUnion(currentUserAuthUid)});
    } else if (relation === "Brother" || relation === "Sister") {
      batch.update(existingMemberRef, {fatherId: currentUserData.fatherId || null, motherId: currentUserData.motherId || null});
      if (currentUserData.fatherId) batch.update(membersRef.doc(currentUserData.fatherId), {childrenIds: FieldValue.arrayUnion(currentUserAuthUid, existingMemberDoc.id)});
      if (currentUserData.motherId) batch.update(membersRef.doc(currentUserData.motherId), {childrenIds: FieldValue.arrayUnion(currentUserAuthUid, existingMemberDoc.id)});
    }

    if (currentUserFamilyId !== existingMemberFamilyId) {
      const membersToMergeQuery = await membersRef.where("familyId", "==", existingMemberFamilyId).get();
      membersToMergeQuery.forEach((doc) => batch.update(doc.ref, {familyId: currentUserFamilyId}));
    }

    await batch.commit();
    return {success: true, message: "Existing member successfully linked."};
  } else if (newMemberDetails.role === "Child") {
    const counterRef = db.collection("counters").doc("memberCounter");
    let newSabhaId;
    await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const newId = counterDoc.exists() ? counterDoc.data().currentId + 1 : 1;
      newSabhaId = String(newId).padStart(7, "0");
      transaction.set(counterRef, {currentId: newId}, {merge: true});
    });
    const newMemberData = {...newMemberDetails, sabhaId: newSabhaId, familyId: currentUserFamilyId, registeredBy: currentUserAuthUid, createdAt: new Date()};
    const newMemberRef = await membersRef.add(newMemberData);
    const batch = db.batch();
    batch.update(currentUserRef, {childrenIds: FieldValue.arrayUnion(newMemberRef.id)});
    if (currentUserData.gender === "Male") batch.update(newMemberRef, {fatherId: currentUserAuthUid});
    else if (currentUserData.gender === "Female") batch.update(newMemberRef, {motherId: currentUserAuthUid});
    await batch.commit();
    return {success: true, message: "New child successfully added."};
  } else {
    throw new functions.https.HttpsError("not-found", "Could not find a registered member to link.");
  }
});


/**
 * Links parents during initial registration if their details are provided.
 */
exports.linkInitialParents = onCall(async (request) => {
    const admin = require("firebase-admin");
    const { userId } = request.data;
    const db = admin.firestore();
    const userRef = db.collection("members").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return {success: false, message: "User not found."};

    const userData = userDoc.data();
    const batch = db.batch();

    // Link Father if details were provided during registration
    if (userData.fatherLinkingAadhaar && userData.fatherLinkingSabhaId) {
        const fatherQuery = await db.collection("members")
            .where("sabhaId", "==", userData.fatherLinkingSabhaId)
            .where("aadhaar", "==", userData.fatherLinkingAadhaar)
            .limit(1).get();
        if (!fatherQuery.empty) {
            const fatherDoc = fatherQuery.docs[0];
            batch.update(userRef, { fatherId: fatherDoc.id });
            batch.update(fatherDoc.ref, { childrenIds: FieldValue.arrayUnion(userId) });
        }
    }
    // Link Mother if details were provided
    if (userData.motherLinkingAadhaar && userData.motherLinkingSabhaId) {
        const motherQuery = await db.collection("members")
            .where("sabhaId", "==", userData.motherLinkingSabhaId)
            .where("aadhaar", "==", userData.motherLinkingAadhaar)
            .limit(1).get();
        if (!motherQuery.empty) {
            const motherDoc = motherQuery.docs[0];
            batch.update(userRef, { motherId: motherDoc.id });
            batch.update(motherDoc.ref, { childrenIds: FieldValue.arrayUnion(userId) });
        }
    }

    await batch.commit();
    return {success: true, message: "Parents linked successfully."};
});

