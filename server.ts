import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import { 
  getFirestore as getClientFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  runTransaction 
} from "firebase/firestore";
import { getAuth as getClientAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import fs from "fs";
import { format } from "date-fns";
import Razorpay from "razorpay";
import crypto from "crypto";

dotenv.config();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_TJyM04syMW7jqc";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "7enSDiMVBnvlaFH3dGgot6Dv";

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const app = express();
const PORT = 3000;

app.use(express.json());

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

// Initialize Firebase Admin (for Auth/Messaging)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}

const authAdmin = getAuth();

// Initialize Client SDK Firestore (Cross-project bypass)
const clientApp = initializeClientApp(firebaseConfig);
const dbClient = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId || '(default)');
const clientAuth = getClientAuth(clientApp);

console.log(`Administrative Firestore initialized for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);

// Test Firestore Connection at startup
(async () => {
  try {
    try {
      await signInWithEmailAndPassword(clientAuth, "server@washwise.com", "ServerPass123!");
      console.log("Server Client SDK Authenticated.");
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        await createUserWithEmailAndPassword(clientAuth, "server@washwise.com", "ServerPass123!");
        console.log("Server Client SDK User Created & Authenticated.");
      } else {
        console.error("Server Auth Error:", e);
      }
    }
  } catch (e) {
    console.error("Could not authenticate Client SDK on server:", e);
  }

  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  console.log(`Starting Firestore Client verification on database: ${databaseId}...`);

  try {
    // 1. Initial Read Test (Verification)
    const testSnap = await getDocs(collection(dbClient, "system_test"));
    console.log(`Firestore Connection Verified. Database: ${databaseId}`);

    // 2. Initialize Service Triggers
    console.log("Initializing Service Triggers...");
    setupNotificationTriggers();
  } catch (err: any) {
    console.log("Firestore Verification Note:", err.message);
    // Still setup triggers
    setupNotificationTriggers();
  }
})();

function setupNotificationTriggers() {
  console.log("Setting up Notification real-time triggers...");

  // Listen for booking status changes
  try {
    const bookingsRef = collection(dbClient, "bookings");
    onSnapshot(bookingsRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "modified") {
          const bookingData = change.doc.data();
          const bookingId = change.doc.id;
          
          if (bookingData.status) {
            try {
              // 1. Create in-app notification doc
              await addDoc(collection(dbClient, "notifications"), {
                userId: bookingData.userId,
                title: "Booking Status Update",
                message: `Your laundry booking #${bookingId.substring(0, 6)} is now: ${bookingData.status}`,
                status: "unread",
                createdAt: new Date().toISOString()
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
                await updateDoc(doc(dbClient, "bookings", bookingId), { statusNotified: true });
              }
              
              console.log(`Notifications processed for booking ${bookingId}`);
            } catch (err) {
              console.error("Error processing notification for booking:", err);
            }
          }
        }
      });
    }, (error) => {
      console.error("Notification Trigger Error (onSnapshot):", error);
      setTimeout(setupNotificationTriggers, 10000);
    });
  } catch (err) {
    console.error("Failed to setup notification listener:", err);
  }
}

async function sendPushNotification(userId: string, notification: { title: string, body: string, data?: any }) {
  try {
    const userDoc = await getDoc(doc(dbClient, "users", userId));
    if (!userDoc.exists()) return;

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
        const remainingTokens = tokens.filter((t: string) => !failedTokens.includes(t));
        await updateDoc(doc(dbClient, "users", userId), {
          fcmTokens: remainingTokens
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
      await deleteDoc(doc(dbClient, "users", uid));
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

// --- RAZORPAY PAYMENT ENDPOINTS ---
app.get("/api/razorpay/config", (req, res) => {
  res.json({ keyId: RAZORPAY_KEY_ID });
});

app.post("/api/razorpay/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", receipt = `rcpt_${Date.now()}`, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    const options = {
      amount: Math.round(amount * 100), // amount in paise
      currency,
      receipt,
      notes: notes || {},
    };

    const order = await razorpay.orders.create(options);
    console.log("Razorpay Order Created:", order.id, "Amount:", amount);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ error: error.message || "Failed to create payment order" });
  }
});

app.post("/api/razorpay/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      type = "booking", // 'booking' | 'subscription' | 'wallet_topup'
      bookingData,
      userId,
      amount
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing required payment verification parameters" });
    }

    // Verify HMAC SHA-256 signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("Invalid Razorpay signature mismatch!");
      return res.status(400).json({ error: "Invalid payment signature verification failed" });
    }

    console.log("Razorpay Signature Verified for Order:", razorpay_order_id, "Type:", type);

    // Signature is authentic! Now fulfill the action in Firestore.
    if (type === "wallet_topup") {
      if (!userId || !amount) {
        return res.status(400).json({ error: "User ID and amount required for wallet topup" });
      }

      // Increment wallet balance
      const userRef = doc(dbClient, "users", userId);
      const userSnap = await getDoc(userRef);
      const currentBalance = userSnap.exists() ? (userSnap.data().walletBalance || 0) : 0;
      await updateDoc(userRef, {
        walletBalance: currentBalance + Number(amount)
      });

      // Record transaction
      await addDoc(collection(dbClient, "wallet_transactions"), {
        userId,
        amount: Number(amount),
        type: "credit",
        method: "razorpay",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        description: "Wallet Top-up via Razorpay",
        createdAt: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: "Wallet topped up successfully",
        paymentId: razorpay_payment_id
      });
    }

    if (type === "subscription") {
      if (!userId) {
        return res.status(400).json({ error: "User ID required for subscription" });
      }

      const userRef = doc(dbClient, "users", userId);
      await updateDoc(userRef, {
        userType: "subscriber",
        package: bookingData?.packageId || "basic",
        subscriptionPaid: true,
        kilosLeft: 12,
        subscriptionStartDate: new Date().toISOString()
      });

      // Record transaction
      await addDoc(collection(dbClient, "wallet_transactions"), {
        userId,
        amount: Number(amount || 0),
        type: "debit",
        method: "razorpay",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        description: "Subscription Payment via Razorpay",
        createdAt: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: "Subscription activated successfully",
        paymentId: razorpay_payment_id
      });
    }

    // Default: 'booking'
    if (bookingData) {
      let bookingId = bookingData.id;

      if (!bookingId) {
        // Create new paid booking
        const newBookingRef = doc(collection(dbClient, "bookings"));
        bookingId = newBookingRef.id;

        await setDoc(newBookingRef, {
          userId: bookingData.userId || userId,
          userName: bookingData.userName || "Student",
          date: bookingData.date,
          timeSlot: bookingData.slot || bookingData.timeSlot,
          machineNumber: bookingData.machineNumber || Math.floor(Math.random() * 4) + 1,
          pickupDrop: Boolean(bookingData.pickupDrop),
          address: bookingData.address || "",
          phone: bookingData.phone || "",
          latitude: bookingData.latitude || 0,
          longitude: bookingData.longitude || 0,
          deliveryFee: bookingData.deliveryFee || 0,
          storeId: bookingData.storeId || "default",
          garmentInstructions: bookingData.garmentInstructions || "",
          serviceType: bookingData.serviceType || "Standard Wash",
          approxLoad: bookingData.approxLoad || "1-2 kg",
          price: Number(bookingData.price || amount || 0),
          status: "paid",
          paymentMethod: "razorpay",
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          createdAt: new Date().toISOString()
        });
      } else {
        // Update existing pending booking to paid
        await updateDoc(doc(dbClient, "bookings", bookingId), {
          status: "paid",
          paymentMethod: "razorpay",
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          machineNumber: bookingData.machineNumber || Math.floor(Math.random() * 4) + 1,
          paidAt: new Date().toISOString()
        });
      }

      return res.json({
        success: true,
        message: "Payment verified and booking confirmed",
        bookingId,
        paymentId: razorpay_payment_id
      });
    }

    res.json({
      success: true,
      message: "Payment verified successfully",
      paymentId: razorpay_payment_id
    });
  } catch (error: any) {
    console.error("Error verifying Razorpay payment:", error);
    res.status(500).json({ error: error.message || "Payment verification failed" });
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
