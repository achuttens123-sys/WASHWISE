import { initializeApp } from "firebase/app";
import { getFirestore, collection, limit, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

async function test() {
  console.log("Testing Client SDK connection...");
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log("Initialized with Database ID:", firebaseConfig.firestoreDatabaseId);
    
    await getDocs(query(collection(db, "system_test"), limit(1)));
    console.log("SUCCESS: Connected to Firestore using Client SDK!");
  } catch (err: any) {
    console.error("FAILED:", err.message);
  }
}

// Need to import query from firestore
import { query } from "firebase/firestore";

test();
