import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, collection, query, where, getDocs, doc, getDoc, runTransaction } from "firebase/firestore";
import fs from "fs";
import { format } from "date-fns";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

// Initialize Firebase Admin (for Auth/Messaging)
if (!admin.apps.length) {
  admin.initializeApp();
}

const authAdmin = getAuth();

// Initialize Administrative Firestore Client (Admin SDK)
const dbAdmin = getFirestore(firebaseConfig.firestoreDatabaseId || '(default)');

// Initialize Client SDK Firestore (Cross-project bypass)
const clientApp = initializeClientApp(firebaseConfig);
const dbClient = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId || '(default)');

console.log(`Administrative Firestore initialized for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);

// Test Firestore Connection at startup
(async () => {
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  console.log(`Starting Firestore Administrative verification on database: ${databaseId}...`);

  try {
    // 1. Initial Read Test (Verification)
    const testSnap = await dbAdmin.collection("system_test").limit(1).get();
    console.log(`Administrative Firestore Connection Verified. Database: ${databaseId}`);

    // 2. Initialize Service Triggers
    console.log("Initializing Service Triggers...");
    setupNotificationTriggers();
  } catch (err: any) {
    console.error("CRITICAL: Administrative Firestore Authorization Failed.");
    console.error("Error details:", err.message);
  }
})();

function setupNotificationTriggers() {
  console.log("Setting up Notification real-time triggers (Admin SDK)...");

  // Listen for booking status changes
  try {
    const bookingsRef = dbAdmin.collection("bookings");
    bookingsRef.onSnapshot((snapshot: any) => {
      snapshot.docChanges().forEach(async (change: any) => {
        if (change.type === "modified") {
          const bookingData = change.doc.data();
          const bookingId = change.doc.id;
          
          if (bookingData.status) {
            try {
              // 1. Create in-app notification doc
              const notificationRef = dbAdmin.collection("notifications").doc();
              await notificationRef.set({
                userId: bookingData.userId,
                title: "Booking Status Update",
                message: `Your laundry booking #${bookingId.substring(0, 6)} is now: ${bookingData.status}`,
                status: "unread",
                createdAt: FieldValue.serverTimestamp()
              });

              // 2. Send External Push Notification for specific milestones
              const notifyStatuses = ["paid", "completed", "rejected", "rescheduled", "Ready to collect", "Out for delivery"];
              if (notifyStatuses.includes(bookingData.status) && !bookingData.statusNotified) {
                await sendPushNotification(bookingData.userId, {
                  title: "Booking Update",
                  body: `Your booking status has changed to: ${bookingData.status}`,
                  data: {
                    bookingId: bookingId,
                    status: bookingData.status
                  }
                });

                // Mark as notified in the booking doc
                await change.doc.ref.update({ statusNotified: true });
              }
              
              console.log(`Notifications processed for booking ${bookingId}`);
            } catch (err) {
              console.error("Error processing notification for booking:", err);
            }
          }
        }
      });
    }, (error: any) => {
      console.error("Notification Trigger Error (onSnapshot):", error);
      // Backoff retry
      setTimeout(setupNotificationTriggers, 10000);
    });
  } catch (err) {
    console.error("Failed to setup notification listener:", err);
  }
}

async function sendPushNotification(userId: string, notification: { title: string, body: string, data?: any }) {
  try {
    const userDoc = await dbAdmin.collection("users").doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const tokens = userData?.fcmTokens || [];

    if (tokens.length === 0) {
      console.log(`No FCM tokens found for user ${userId}`);
      return;
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Successfully sent ${response.successCount} notifications; ${response.failureCount} failed.`);
    
    // Clean up failed tokens
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      
      if (failedTokens.length > 0) {
        await dbAdmin.collection("users").doc(userId).update({
          fcmTokens: FieldValue.arrayRemove(...failedTokens)
        });
      }
    }
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

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

// --- LIMITED SLOT OFFER ENGINE ---
app.get("/api/offers/active", async (req, res) => {
  try {
    const today = format(new Date(), "yyyy-MM-dd");
    const now = format(new Date(), "HH:mm");
    
    // Use Client SDK to bypass Admin SDK permission issues in AI Studio
    const offersRef = collection(dbClient, "limited_offers");
    const q = query(offersRef, where("isActive", "==", true));
    const offersSnap = await getDocs(q);

    const activeOffers = [];

    for (const offerDoc of offersSnap.docs) {
      const data = offerDoc.data();
      
      // Basic validity check
      if (data.startDate && data.startDate > today) continue;
      if (data.endDate && data.endDate < today) continue;
      if (data.startTime && data.startTime > now) continue;
      if (data.endTime && data.endTime < now) continue;

      // Get current usage
      let currentCount = 0;
      if (data.dailyReset) {
        const statsRef = doc(dbClient, "limited_offers", offerDoc.id, "daily_stats", today);
        const statsSnap = await getDoc(statsRef);
        currentCount = statsSnap.exists() ? statsSnap.data()?.count || 0 : 0;
      } else {
        currentCount = data.usage?.total || 0;
      }

      activeOffers.push({
        offerId: offerDoc.id,
        name: data.name,
        remainingSlots: Math.max(0, data.maxUsers - currentCount),
        discountType: data.discountType,
        discountValue: data.discountValue,
        description: data.description || `${data.discountType === 'fixed_price' ? '₹' : ''}${data.discountValue}${data.discountType === 'percentage' ? '% OFF' : ''}`,
        expiresAt: data.endTime ? `${today}T${data.endTime}:00` : `${data.endDate}T23:59:59`
      });
    }

    res.json(activeOffers);
  } catch (error: any) {
    console.error("Error fetching active offers:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/booking/apply-offer", async (req, res) => {
  const { userId, offerId, cartValue, serviceType, userDetails } = req.body;
  const today = format(new Date(), "yyyy-MM-dd");

  try {
    const result = await runTransaction(dbClient, async (transaction) => {
      const offerRef = doc(dbClient, "limited_offers", offerId);
      const offerSnap = await transaction.get(offerRef);

      if (!offerSnap.exists()) throw new Error("Offer not found");
      const offer = offerSnap.data()!;

      // 1. Basic Validity
      if (!offer.isActive) throw new Error("Offer is no longer active");
      if (offer.minOrderValue && cartValue < offer.minOrderValue) {
        throw new Error(`Minimum order value ₹${offer.minOrderValue} required`);
      }
      if (offer.applicableServices && !offer.applicableServices.includes(serviceType)) {
        throw new Error("Offer not applicable for this service");
      }

      // 2. Global/Daily Capacity Check
      let statsRef;
      if (offer.dailyReset) {
        statsRef = doc(dbClient, "limited_offers", offerId, "daily_stats", today);
      } else {
        statsRef = offerRef; // Use the main doc count
      }

      const statsSnap = await transaction.get(statsRef);
      const statsData = statsSnap.data() as any;
      const currentCount = statsSnap.exists() ? (offer.dailyReset ? statsData?.count : statsData?.usage?.total) || 0 : 0;

      if (currentCount >= offer.maxUsers) {
        throw new Error("No more slots available for this offer today");
      }

      // 3. User Eligibility & Abuse Prevention
      // A. Check per-user limit
      const redemptionId = `${userId}_${offerId}_${offer.dailyReset ? today : 'global'}`;
      const redemptionRef = doc(dbClient, "offer_redemptions", redemptionId);
      const redemptionSnap = await transaction.get(redemptionRef);
      const redemptionData = redemptionSnap.data() as any;
      const userRedemptionCount = redemptionSnap.exists() ? redemptionData?.count || 0 : 0;

      if (userRedemptionCount >= (offer.perUserLimit || 1)) {
        throw new Error("You have reached the limit for this offer");
      }

      // B. Fingerprinting (Address/Phone)
      if (userDetails?.phone || userDetails?.address) {
        // Queries are NOT allowed inside transactions in the Client SDK v9+.
        // Better to use an external check OR just rely on Auth UID + per-user limit.
        // For university scale, Auth UID is usually sufficient.
      }

      // SUCCESS - Apply atomic increments
      const now = new Date().toISOString();
      if (offer.dailyReset) {
        transaction.set(statsRef, { 
          count: (currentCount || 0) + 1,
          date: today,
          lastRedeemedAt: now
        }, { merge: true });
      } else {
        transaction.update(offerRef, { 
          "usage.total": (currentCount || 0) + 1,
          "usage.lastRedeemedAt": now
        });
      }

      transaction.set(redemptionRef, {
        userId,
        offerId,
        date: today,
        count: (userRedemptionCount || 0) + 1,
        phone: userDetails?.phone,
        address: userDetails?.address,
        lastRedeemedAt: now
      }, { merge: true });

      // Calculate new price
      let newPrice = cartValue;
      if (offer.discountType === "fixed_price") {
        newPrice = offer.discountValue;
      } else if (offer.discountType === "percentage") {
        newPrice = cartValue * (1 - offer.discountValue / 100);
      } else if (offer.discountType === "flat") {
        newPrice = Math.max(0, cartValue - offer.discountValue);
      }

      return {
        success: true,
        originalPrice: cartValue,
        discountedPrice: newPrice,
        offerApplied: offer.name,
        message: "Offer applied successfully!"
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error applying limited offer:", error);
    res.status(400).json({ error: error.message });
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
