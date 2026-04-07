import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import bcrypt from "bcryptjs";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

console.log("Environment Project ID (GOOGLE_CLOUD_PROJECT):", process.env.GOOGLE_CLOUD_PROJECT);
console.log("Environment Project ID (PROJECT_ID):", process.env.PROJECT_ID);

// Explicitly set project ID in environment to ensure Admin SDK uses the correct project
process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
process.env.GCLOUD_PROJECT = firebaseConfig.projectId;

// Initialize Firebase Admin
if (!admin.apps.length) {
  console.log("Initializing Firebase Admin...");
  console.log("Config Project ID:", firebaseConfig.projectId);
  
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
    });
    console.log("Firebase Admin initialized with ADC.");
  } catch (e) {
    console.error("Failed to initialize Firebase Admin:", e);
  }
}

const adminApp = admin.app();
console.log("Admin App Options Project ID:", adminApp.options.projectId);

const dbAdmin = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(adminApp);

const authAdmin = getAuth(adminApp);

// Test Firestore Connection at startup
(async () => {
  try {
    console.log("Testing Firestore connection...");
    console.log(`Using database: ${firebaseConfig.firestoreDatabaseId || "(default)"}`);
    const testSnapshot = await dbAdmin.collection("users").limit(1).get();
    console.log("Firestore connection test successful. Found docs:", testSnapshot.size);
    
    // Initialize Leaderboard Listener
    setupLeaderboardTrigger();
    
    // Initialize Mission Progress Listeners
    setupMissionTriggers();
  } catch (err: any) {
    console.error("Firestore connection test FAILED with named database:", err);
    if (firebaseConfig.firestoreDatabaseId) {
      console.log("Attempting to connect to the (default) database instead...");
      try {
        const defaultDb = getFirestore(adminApp);
        const defaultSnapshot = await defaultDb.collection("users").limit(1).get();
        console.log("Firestore connection test successful with (default) database. Found docs:", defaultSnapshot.size);
        // If this works, we might need to update the config or use the default DB.
      } catch (defaultErr) {
        console.error("Firestore connection test FAILED with (default) database too:", defaultErr);
      }
    }
    
    if (err.code === 7 || err.message?.includes("PERMISSION_DENIED")) {
      console.error("This is a permission error. Check if the service account has access to the database.");
      console.error("Project ID:", firebaseConfig.projectId);
      console.error("Database ID:", firebaseConfig.firestoreDatabaseId);
    }
  }
})();

function setupMissionTriggers() {
  console.log("Setting up Mission real-time triggers...");

  // 1. Listen for completed bookings
  dbAdmin.collection("bookings").onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "modified") {
        const bookingData = change.doc.data();
        if (bookingData.status === "completed" && !bookingData.missionProcessed) {
          console.log(`Processing mission progress for completed booking: ${change.doc.id}`);
          await updateMissionProgress(bookingData.userId, "orders", 1);
          // Mark booking as processed to avoid double counting
          await change.doc.ref.update({ missionProcessed: true });
        }
      }
    });
  }, (error) => {
    console.error("Booking Mission Listener Error:", error);
    setTimeout(setupMissionTriggers, 5000);
  });

  // 2. Listen for completed referrals
  dbAdmin.collection("referrals").onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "modified" || change.type === "added") {
        const referralData = change.doc.data();
        if (referralData.status === "completed" && !referralData.missionProcessed) {
          console.log(`Processing mission progress for completed referral: ${change.doc.id}`);
          await updateMissionProgress(referralData.referrerId, "referrals", 1);
          await change.doc.ref.update({ missionProcessed: true });
        }
      }
    });
  }, (error) => {
    console.error("Referral Mission Listener Error:", error);
  });

  // 3. Listen for paid subscriptions
  dbAdmin.collection("bookings").onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "modified" || change.type === "added") {
        const bookingData = change.doc.data();
        if (bookingData.status === "paid" && bookingData.serviceType === "Subscription" && !bookingData.subscriptionProcessed) {
          console.log(`Processing subscription activation for booking: ${change.doc.id}`);
          try {
            await dbAdmin.collection("users").doc(bookingData.userId).update({
              subscriptionPaid: true,
              subscriptionStartDate: new Date().toISOString(),
              package: bookingData.packageId || "basic"
            });
            await change.doc.ref.update({ subscriptionProcessed: true });
          } catch (err) {
            console.error("Error activating subscription:", err);
          }
        }
      }
    });
  }, (error) => {
    console.error("Subscription Payment Listener Error:", error);
  });
}

async function updateMissionProgress(userId: string, type: string, increment: number) {
  try {
    // Get all missions of this type
    const missionsSnapshot = await dbAdmin.collection("missions").where("requirement.type", "==", type).get();
    
    for (const missionDoc of missionsSnapshot.docs) {
      const missionData = missionDoc.data();
      const missionId = missionDoc.id;
      
      // Find or create UserMission
      const userMissionId = `${userId}_${missionId}`;
      const userMissionRef = dbAdmin.collection("userMissions").doc(userMissionId);
      const userMissionSnap = await userMissionRef.get();
      
      let currentProgress = 0;
      let status = "in-progress";
      
      if (userMissionSnap.exists) {
        const data = userMissionSnap.data()!;
        if (data.status !== "in-progress") continue; // Already completed or claimed
        currentProgress = data.progress || 0;
      }
      
      const newProgress = currentProgress + increment;
      if (newProgress >= missionData.requirement.value) {
        status = "completed";
        console.log(`Mission ${missionId} completed for user ${userId}`);
      }
      
      await userMissionRef.set({
        userId,
        missionId,
        progress: newProgress,
        status,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  } catch (err) {
    console.error(`Error updating mission progress for user ${userId}:`, err);
  }
}

function setupLeaderboardTrigger() {
  console.log("Setting up Leaderboard real-time trigger...");
  
  dbAdmin.collection("users").onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "added" || change.type === "modified") {
        const userData = change.doc.data();
        const userId = change.doc.id;
        
        // Only update if points or xp exists
        if (userData.points !== undefined || userData.xp !== undefined) {
          try {
            const leaderboardRef = dbAdmin.collection("leaderboard").doc(userId);
            
            await leaderboardRef.set({
              userId: userId,
              userName: userData.name || "Anonymous",
              photoURL: userData.photoURL || null,
              totalScore: userData.points || 0,
              xp: userData.xp || 0,
              level: userData.level || "Bronze",
              lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              // Preserve other fields if they exist
            }, { merge: true });
            
            console.log(`Leaderboard updated for user: ${userId}`);
          } catch (err) {
            console.error(`Error updating leaderboard for user ${userId}:`, err);
          }
        }
      }
    });
  }, (error) => {
    console.error("Leaderboard Listener Error:", error);
    // Attempt to restart listener after a delay
    setTimeout(setupLeaderboardTrigger, 5000);
  });
}

// API routes
app.post("/api/auth/create-staff", async (req, res) => {
  const { staffData, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create or update user in Firestore
    // We use staffId as the document ID or a random UID?
    // The user wants StaffID to be unique.
    const staffId = staffData.staffId;
    
    console.log(`Attempting to create staff with ID: ${staffId}`);
    
    // Check if staffId already exists
    const existing = await dbAdmin.collection("users").where("staffId", "==", staffId).get();
    if (!existing.empty) {
      console.warn(`Staff ID ${staffId} already exists.`);
      return res.status(400).json({ success: false, error: "Staff ID already exists" });
    }

    console.log(`Creating Firebase Auth user for: ${staffData.email || staffId}`);
    let userRecord;
    try {
      userRecord = await authAdmin.createUser({
        displayName: staffData.name,
        email: staffData.email || `${staffId.toLowerCase()}@washwise.staff`,
        disabled: staffData.status === "inactive",
      });
      console.log(`Auth user created with UID: ${userRecord.uid}`);
    } catch (authErr) {
      console.error("Auth Create User Error:", authErr);
      return res.status(500).json({ 
        success: false, 
        error: "Auth Error: " + (authErr instanceof Error ? authErr.message : String(authErr)) 
      });
    }

    try {
      console.log(`Saving to Firestore for UID: ${userRecord.uid} in database: ${firebaseConfig.firestoreDatabaseId || '(default)'}...`);
      const userData = {
        ...staffData,
        uid: userRecord.uid,
        password: hashedPassword, // Stored hashed
        isFirstLogin: true,
        createdAt: FieldValue.serverTimestamp(),
      };

      await dbAdmin.collection("users").doc(userRecord.uid).set(userData);
      console.log(`Staff document saved successfully`);
    } catch (dbErr: any) {
      console.error("Firestore Set Doc Error:", dbErr);
      console.error("Error Code:", dbErr.code);
      console.error("Error Details:", dbErr.details);
      return res.status(500).json({ 
        success: false, 
        error: `Firestore Error (${dbErr.code}): ` + (dbErr.message || String(dbErr)) 
      });
    }

    res.json({ success: true, uid: userRecord.uid });
  } catch (err) {
    console.error("Create Staff Error:", err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { staffId, password } = req.body;

  try {
    const snapshot = await dbAdmin.collection("users").where("staffId", "==", staffId).get();
    
    if (snapshot.empty) {
      return res.status(401).json({ success: false, error: "Invalid Staff ID or Password" });
    }

    const userData = snapshot.docs[0].data();
    
    if (userData.status === "inactive") {
      return res.status(401).json({ success: false, error: "Account is inactive" });
    }

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid Staff ID or Password" });
    }

    // Generate Custom Token for Firebase Auth
    const customToken = await authAdmin.createCustomToken(userData.uid);

    res.json({ 
      success: true, 
      token: customToken, 
      isFirstLogin: userData.isFirstLogin,
      uid: userData.uid
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/auth/change-password", async (req, res) => {
  const { uid, newPassword } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbAdmin.collection("users").doc(uid).update({
      password: hashedPassword,
      isFirstLogin: false
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Change Password Error:", err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/auth/delete-user", async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ success: false, error: "User UID is required" });
  }

  try {
    console.log(`Attempting to delete user: ${uid}`);
    
    // Delete from Firebase Auth
    try {
      await authAdmin.deleteUser(uid);
      console.log(`Auth user ${uid} deleted successfully`);
    } catch (authErr: any) {
      // If user doesn't exist in Auth, we might still want to delete from Firestore
      if (authErr.code === 'auth/user-not-found') {
        console.warn(`Auth user ${uid} not found, proceeding to Firestore deletion`);
      } else {
        console.error("Auth Delete User Error:", authErr);
        throw authErr;
      }
    }

    // Delete from Firestore
    try {
      await dbAdmin.collection("users").doc(uid).delete();
      console.log(`Firestore document for ${uid} deleted successfully`);
    } catch (dbErr: any) {
      console.error("Firestore Delete Doc Error:", dbErr);
      throw dbErr;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete User Error:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || String(err) 
    });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
