import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

async function test() {
  console.log("Testing Admin SDK connection...");
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log("Initialized with Project ID:", firebaseConfig.projectId);
    
    const db = getFirestore(admin.app(), "(default)");
    await db.collection("system_test").limit(1).get();
    console.log("SUCCESS: Connected to Firestore!");
  } catch (err: any) {
    console.error("FAILED:", err.message);
  }
}

test();
