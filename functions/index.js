// Version: 2.2.0
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2/options");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");

setGlobalOptions({region: "asia-south1"});
initializeApp();
const db = getFirestore();
const auth = getAuth();

/**
 * Creates a new family from scratch, including the primary user (Head of Family)
 * and an optional spouse.
 */
exports.registerNewFamily = onCall(async (request) => {
  const {familyData} = request.data;
  if (!familyData || !familyData.email || !familyData.password) {
    throw new HttpsError("invalid-argument", "Missing essential user data.");
  }

  // 1. Check if Aadhaar already exists to prevent duplicates
  const membersRef = db.collection("members");
  const existingAadhaarQuery = await membersRef
      .where("aadhaar", "==", familyData.aadhaar).limit(1).get();
  if (!existingAadhaarQuery.empty) {
    throw new HttpsError("already-exists",
        "A member with this Aadhaar number is already registered.");
  }

  // Use a transaction to ensure atomic operations for counter and writes
  return db.runTransaction(async (transaction) => {
    // 2. Get a new unique Sabha ID for the primary user
    const counterRef = db.collection("counters").doc("memberCounter");
    const counterDoc = await transaction.get(counterRef);
    const primaryId = counterDoc.exists ? counterDoc.data().currentId + 1 : 1;
    const primarySabhaId = String(primaryId).padStart(7, "0");

    // 3. Create the Firebase Auth user
    const userRecord = await auth.createUser({
      email: familyData.email,
      password: familyData.password,
      displayName: familyData.fullName,
    });

    // 4. Prepare primary member data
    const primaryMemberRef = membersRef.doc(); // Auto-generate a document ID
    const primaryMemberData = {
      sabhaId: primarySabhaId,
      familyId: primaryMemberRef.id, // The first member's doc ID is the family ID
      authUid: userRecord.uid,
      fullName: familyData.fullName,
      aadhaar: familyData.aadhaar,
      dob: familyData.dob,
      gender: familyData.gender,
      email: familyData.email,
      profilePhotoUrl: null,
      createdAt: FieldValue.serverTimestamp(),
    };

    // 5. Handle spouse if details are provided
    if (familyData.spouse_fullName && familyData.spouse_aadhaar) {
      const spouseId = primaryId + 1;
      const spouseSabhaId = String(spouseId).padStart(7, "0");

      const spouseMemberRef = membersRef.doc();
      const spouseMemberData = {
        sabhaId: spouseSabhaId,
        familyId: primaryMemberRef.id, // Same family ID
        fullName: familyData.spouse_fullName,
        aadhaar: familyData.spouse_aadhaar,
        dob: familyData.spouse_dob,
        gender: familyData.spouse_gender,
        createdAt: FieldValue.serverTimestamp(),
        spouseId: primaryMemberRef.id, // Link to primary member
      };
      primaryMemberData.spouseId = spouseMemberRef.id; // Link back to spouse
      transaction.set(spouseMemberRef, spouseMemberData);
      transaction.set(counterRef, {currentId: spouseId}); // Update counter
    } else {
      transaction.set(counterRef, {currentId: primaryId}); // Update counter
    }

    transaction.set(primaryMemberRef, primaryMemberData);
    return {success: true};
  });
});


exports.createAccountForMember = onCall(async (request) => {
  const {docId, email, password} = request.data;
  if (!docId || !email || !password) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  try {
    const userRecord = await auth.createUser({email, password});
    const memberRef = db.collection("members").doc(docId);
    await memberRef.update({authUid: userRecord.uid, email: email});
    return {success: true, uid: userRecord.uid};
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "This email is already in use.");
    }
    throw new HttpsError("internal", "Error creating account.");
  }
});

exports.verifyMemberById = onCall(async (request) => {
  const {sabhaId, aadhaar} = request.data;
  if (!sabhaId || !aadhaar || aadhaar.length !== 12) {
    throw new HttpsError("invalid-argument", "Invalid input provided.");
  }
  const snapshot = await db.collection("members")
      .where("sabhaId", "==", sabhaId)
      .where("aadhaar", "==", aadhaar)
      .limit(1).get();
  if (snapshot.empty) {
    return {success: false, message: "Details not found."};
  }
  const memberDoc = snapshot.docs[0];
  if (memberDoc.data().authUid) {
    return {success: false, message: "An online account already exists."};
  }
  return {success: true, fullName: memberDoc.data().fullName, docId: memberDoc.id};
});

exports.findMemberByName = onCall(async (request) => {
  const {fullName, aadhaar, dob} = request.data;
  if (!fullName || !aadhaar || !dob) {
    throw new HttpsError("invalid-argument", "Invalid input provided.");
  }
  const snapshot = await db.collection("members")
      .where("fullName", "==", fullName)
      .where("aadhaar", "==", aadhaar)
      .where("dob", "==", dob)
      .limit(1).get();
  if (snapshot.empty) {
    return {success: false, message: "No profile found."};
  }
  const memberDoc = snapshot.docs[0];
  if (memberDoc.data().authUid) {
    return {success: false, message: "An online account already exists."};
  }
  return {success: true, fullName: memberDoc.data().fullName, docId: memberDoc.id};
});

exports.linkOrCreateFamilyMember = onCall(async (request) => {
  const {newMemberDetails, currentUserDocId} = request.data;
  if (!newMemberDetails || !currentUserDocId) {
    throw new HttpsError("invalid-argument", "Invalid data.");
  }

  const membersRef = db.collection("members");
  const currentUserRef = membersRef.doc(currentUserDocId);
  const currentUserDoc = await currentUserRef.get();
  if (!currentUserDoc.exists) {
    throw new HttpsError("not-found", "Current user not found.");
  }
  const currentUserData = currentUserDoc.data();

  // Case 2: Adding a new child
  if (newMemberDetails.role === "Child") {
    return db.runTransaction(async (transaction) => {
        const counterRef = db.collection("counters").doc("memberCounter");
        const counterDoc = await transaction.get(counterRef);
        const newId = counterDoc.exists() ? counterDoc.data().currentId + 1 : 1;
        const newSabhaId = String(newId).padStart(7, "0");

        const newMemberRef = membersRef.doc();
        const newMemberData = {
            fullName: newMemberDetails.fullName,
            dob: newMemberDetails.dob,
            gender: newMemberDetails.gender,
            sabhaId: newSabhaId,
            familyId: currentUserData.familyId,
            registeredBy: currentUserDocId,
            createdAt: FieldValue.serverTimestamp(),
            fatherId: currentUserData.gender === "Male" ? currentUserDocId : (currentUserData.spouseId || null),
            motherId: currentUserData.gender === "Female" ? currentUserDocId : (currentUserData.spouseId || null)
        };
        transaction.set(newMemberRef, newMemberData);
        transaction.update(currentUserRef, { childrenIds: FieldValue.arrayUnion(newMemberRef.id) });
        if(currentUserData.spouseId) {
            transaction.update(membersRef.doc(currentUserData.spouseId), { childrenIds: FieldValue.arrayUnion(newMemberRef.id) });
        }
        transaction.set(counterRef, {currentId: newId}, {merge: true});
        return {success: true, message: "New child successfully added."};
    });
  }
  
  // Case 1: Linking an existing member
  const { sabhaId, aadhaar, role } = newMemberDetails;
  if (!sabhaId || !aadhaar) {
      throw new HttpsError("invalid-argument", "Sabha ID and Aadhaar are required to link an existing member.");
  }
  const existingMemberQuery = await membersRef.where("sabhaId", "==", sabhaId).where("aadhaar", "==", aadhaar).limit(1).get();

  if (existingMemberQuery.empty) {
      throw new HttpsError("not-found", "Could not find a registered member with those details.");
  }

  const existingMemberDoc = existingMemberQuery.docs[0];
  const batch = db.batch();

  if (role === "Spouse") {
      batch.update(currentUserRef, { spouseId: existingMemberDoc.id });
      batch.update(existingMemberDoc.ref, { spouseId: currentUserDocId });
  } else if (role === "Father") {
      batch.update(currentUserRef, { fatherId: existingMemberDoc.id });
      batch.update(existingMemberDoc.ref, { childrenIds: FieldValue.arrayUnion(currentUserDocId) });
  } else if (role === "Mother") {
      batch.update(currentUserRef, { motherId: existingMemberDoc.id });
      batch.update(existingMemberDoc.ref, { childrenIds: FieldValue.arrayUnion(currentUserDocId) });
  } else if (role === "Brother" || role === "Sister") {
      // Logic for siblings can be complex, for now we just establish the parent links
      batch.update(existingMemberDoc.ref, {
        fatherId: currentUserData.fatherId || null,
        motherId: currentUserData.motherId || null,
      });
  }

  await batch.commit();
  return {success: true, message: "Existing member successfully linked."};
});