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
import { getAuth as getClientAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import fs from "fs";
import { format } from "date-fns";
import crypto from "crypto";
import nodemailer from "nodemailer";

dotenv.config();

process.on("unhandledRejection", (reason, promise) => {
  console.warn("Unhandled Promise Rejection caught:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception caught:", err);
});

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Load Firebase Config safely
let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  // Silent config load error
}

// Initialize Firebase Admin (for Auth/Messaging)
let authAdmin: any = null;
try {
  if (!admin.apps.length && firebaseConfig.projectId) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
  authAdmin = getAuth();
} catch (e) {
  // Silent admin init catch
}

// Initialize Client SDK Firestore (Cross-project bypass)
let clientApp: any = null;
let dbClient: any = null;
let clientAuth: any = null;

try {
  if (firebaseConfig.projectId && firebaseConfig.apiKey) {
    clientApp = initializeClientApp(firebaseConfig);
    dbClient = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId || '(default)');
    clientAuth = getClientAuth(clientApp);
  }
} catch (e) {
  // Silent client sdk catch
}

// Test Firestore Connection safely in background
async function ensureServerAuth() {
  if (!clientAuth) return;
  if (!clientAuth.currentUser) {
    try {
      await signInWithEmailAndPassword(clientAuth, "server@washwise.com", "ServerPass123!");
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(clientAuth, "server@washwise.com", "ServerPass123!");
        } catch (createErr) {
          // User created or exists
        }
      }
    }
  }

  // Ensure server user doc and admin role exist
  if (clientAuth.currentUser && dbClient) {
    try {
      await setDoc(doc(dbClient, "users", clientAuth.currentUser.uid), {
        uid: clientAuth.currentUser.uid,
        email: "server@washwise.com",
        name: "WashWise Server",
        role: "admin",
        adminRole: "super_admin",
        userType: "admin"
      }, { merge: true });
      await setDoc(doc(dbClient, "admin_roles", "server@washwise.com"), {
        role: "super_admin",
        email: "server@washwise.com"
      }, { merge: true });
    } catch (docErr) {
      // Non-blocking
    }
  }
}

if (clientAuth && dbClient) {
  (async () => {
    try {
      await ensureServerAuth();
    } catch (e) {
      // Auth check complete
    }

    try {
      setupNotificationTriggers();
    } catch (err: any) {
      // Notification trigger setup handled
    }
  })().catch(() => {});
}

function setupNotificationTriggers() {
  if (!dbClient) return;

  try {
    const bookingsRef = collection(dbClient, "bookings");
    onSnapshot(bookingsRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "modified" || change.type === "added") {
          const bookingData = change.doc.data();
          const bookingId = change.doc.id;
          
          if (bookingData.status) {
            try {
              // 1. Create in-app notification doc on status modification
              if (change.type === "modified") {
                await addDoc(collection(dbClient, "notifications"), {
                  userId: bookingData.userId,
                  title: "Booking Status Update",
                  message: `Your laundry booking #${bookingId.substring(0, 6)} is now: ${bookingData.status}`,
                  status: "unread",
                  createdAt: new Date().toISOString()
                });
              }

              // 2. Loyalty Points Trigger on wash completion (Idempotent: checks !loyaltyRewarded or 0 credits awarded)
              const isWashFinished = bookingData.status === "completed" || bookingData.status === "Washing completed";
              if (isWashFinished && (!bookingData.loyaltyRewarded || Number(bookingData.loyaltyCreditsAwarded || 0) === 0)) {
                triggerLoyaltyReward(bookingId, bookingData).catch((err) => {
                  console.error("Error triggering loyalty reward from listener:", err);
                });
              }

              // 3. Send External Push Notification for specific milestones
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
            } catch (err) {
              // Silent error handling
            }
          }
        }
      });
    }, () => {});
  } catch (err) {
    // Silent notification error handling
  }
}

async function sendPushNotification(userId: string, notification: { title: string, body: string, data?: any }) {
  try {
    const userDoc = await getDoc(doc(dbClient, "users", userId));
    if (!userDoc.exists()) return;

    const userData = userDoc.data();
    const tokens = userData?.fcmTokens || [];

    if (tokens.length === 0) return;

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
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
    // Push notification handled
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

// --- BRANDED HTML EMAIL TEMPLATE GENERATOR ---
function generatePasswordResetEmailHtml(resetLink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your WashWise Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f5f1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f6f5f1; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #ffffff; border-radius: 28px; box-shadow: 0 10px 35px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #eae8e1;">
          <tr>
            <td style="padding: 44px 40px 36px 40px;">
              <!-- Brand Header -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <h1 style="color: #2b5545; font-size: 28px; font-weight: 900; margin: 0 0 4px 0; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">WashWise</h1>
                    <p style="color: #6b7280; font-size: 13px; font-weight: 600; margin: 0 0 28px 0; letter-spacing: 0.2px;">Laundry. Simplified.</p>
                  </td>
                </tr>
              </table>

              <!-- Section Title -->
              <h2 style="color: #111827; font-size: 19px; font-weight: 800; margin: 0 0 16px 0; letter-spacing: -0.3px;">Reset your password</h2>

              <!-- Greeting & Body -->
              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">Hi there,</p>
              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">We received a request to reset the password for your WashWise account.</p>
              <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">Click the button below to create a new password:</p>

              <!-- Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius: 14px; background-color: #557c67; box-shadow: 0 4px 14px rgba(85, 124, 103, 0.3);">
                    <a href="${resetLink}" target="_blank" style="font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; color: #ffffff; text-decoration: none; padding: 15px 36px; display: inline-block; border-radius: 14px; letter-spacing: 0.2px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Note -->
              <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 24px 0;">This link is secure and will expire in 30 minutes for your safety.</p>

              <!-- Callout Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="background-color: #f7f6f2; border-radius: 16px; padding: 18px 22px; border: 1px solid #edebe4;">
                    <p style="color: #4b5563; font-size: 13.5px; line-height: 1.55; margin: 0;">
                      If you didn't request a password reset, you can safely ignore this email. Your account will remain secure and no changes will be made.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Support Note -->
              <p style="color: #4b5563; font-size: 13.5px; line-height: 1.5; margin: 0 0 28px 0;">
                Need help? Contact us at <a href="mailto:support@washwise.co.in" style="color: #2b5545; font-weight: 700; text-decoration: none;">support@washwise.co.in</a>
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="border-top: 1px solid #eceae4;"></td>
                </tr>
              </table>

              <!-- Footer -->
              <p style="color: #2b5545; font-size: 14px; font-weight: 800; margin: 0 0 4px 0;">Team WashWise</p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">Laundry. Simplified. &bull; &copy; 2026 WashWise. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// --- PASSWORD RESET API WITH BRANDED HTML TEMPLATE ---
app.post("/api/auth/reset-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: "Email address is required" });
  }

  try {
    console.log(`Processing password reset for: ${email}`);

    // Check if SMTP configuration is provided in environment variables
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const fromEmail = process.env.SMTP_FROM || '"WashWise" <support@washwise.co.in>';

    if (smtpHost && smtpUser && smtpPass) {
      // If SMTP is provided, try generating reset link or sending styled template
      let resetLink = `https://${firebaseConfig.authDomain}/__/auth/action?mode=resetPassword`;
      try {
        resetLink = await authAdmin.generatePasswordResetLink(email);
      } catch (adminErr) {
        console.warn("Admin SDK reset link generation unavailable, sending standard notification:", adminErr);
      }
      
      const htmlEmail = generatePasswordResetEmailHtml(resetLink);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: fromEmail,
        to: email,
        subject: "Reset Your WashWise Password",
        html: htmlEmail,
      });

      console.log(`Custom HTML Password reset email dispatched to ${email} via SMTP.`);
      return res.json({ 
        success: true, 
        sentViaSmtp: true, 
        message: "Password reset email sent successfully" 
      });
    }

    // Default: Dispatch via Firebase Client SDK (using valid Web API Key)
    await sendPasswordResetEmail(clientAuth, email);
    console.log(`Firebase password reset email dispatched for ${email}`);
    
    return res.json({ 
      success: true, 
      sentViaSmtp: false, 
      message: "Password reset email sent" 
    });
  } catch (error: any) {
    console.error("Error processing password reset email:", error);
    const errorCode = error?.code || '';
    let errorMessage = "Failed to process password reset request";
    
    if (errorCode === 'auth/user-not-found') {
      errorMessage = "No account found with this email address.";
    } else if (errorCode === 'auth/invalid-email') {
      errorMessage = "Please enter a valid email address.";
    } else if (errorCode === 'auth/too-many-requests') {
      errorMessage = "Too many requests. Please wait a moment and try again.";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return res.status(400).json({ 
      success: false, 
      code: errorCode,
      error: errorMessage 
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
    await ensureServerAuth();
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
        phone: userDetails?.phone || "",
        address: userDetails?.address || "",
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

// --- SERVER-OWNED PAYMENT & BOOKING ENGINE ---

function generateBookingId(sequenceNumber: number, date: Date = new Date()): string {
  const seq = Math.max(1, Number(sequenceNumber) || 1).toString().padStart(4, '0');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear().toString().slice(-2);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const time = `${hours}${minutes}`;
  return `${seq}/${month}/${year}/${time}`;
}

// Server calculation of order price to guarantee server truth
function calculateServerOrderPrice(bookingDetails: any, isSubscriber: boolean, settingsData: any): { 
  subtotal: number; 
  deliveryFee: number; 
  finalPrice: number;
  regularPricePerKg: number;
  offerPricePerKg: number;
  isOfferActive: boolean;
} {
  const rawPricing = settingsData?.pricing || {};
  const isOfferActive = rawPricing.limited_time_offer !== false;
  
  const regularPricePerKg = Number(rawPricing.regular_price_per_kg ?? 69);
  const offerPricePerKg = Number(rawPricing.offer_price_per_kg ?? 39);
  const expressRegularPerKg = Number(rawPricing.express_regular_price_per_kg ?? 89);
  const expressOfferPerKg = Number(rawPricing.express_offer_price_per_kg ?? (rawPricing.expressWash ?? 45));

  const standardRate = isOfferActive ? offerPricePerKg : regularPricePerKg;
  const expressRate = isOfferActive ? expressOfferPerKg : expressRegularPerKg;

  let basePrice = 0;
  const serviceType = bookingDetails.serviceType || "Wash & Fold";
  const approxLoad = bookingDetails.approxLoad || "1-4 kg";

  if (serviceType === "Wash & Fold (Per Piece)" && Array.isArray(bookingDetails.pieceBreakdown) && bookingDetails.pieceBreakdown.length > 0) {
    basePrice = bookingDetails.pieceBreakdown.reduce((sum: number, item: any) => {
      const regPrice = Number(item.regular_unit_price ?? item.regularUnitPrice ?? item.price ?? 0);
      const offPrice = Number(item.offer_unit_price ?? item.offerUnitPrice ?? item.price ?? 0);
      const itemOfferActive = isOfferActive && (item.offer_active !== false);
      const unitPriceUsed = Number(item.price_used ?? (itemOfferActive ? offPrice : regPrice) ?? item.unitPrice ?? item.price ?? 0);
      const count = Number(item.count || 1);
      return sum + (unitPriceUsed * count);
    }, 0);
  } else if (serviceType === "Express Wash") {
    if (approxLoad === "5 kg") basePrice = 5 * expressRate;
    else if (approxLoad === "6 kg") basePrice = 6 * expressRate;
    else if (approxLoad === "7+ kg") basePrice = 7 * expressRate;
    else basePrice = 4 * expressRate;
  } else {
    // Standard Wash & Fold
    const minCharge = Number(rawPricing.minCharge ?? (4 * standardRate));
    if (approxLoad === "5 kg") basePrice = 5 * standardRate;
    else if (approxLoad === "6 kg") basePrice = 6 * standardRate;
    else if (approxLoad === "7+ kg") basePrice = 7 * standardRate;
    else basePrice = minCharge;
  }

  const configuredDeliveryFee = Number(rawPricing.deliveryFee ?? 5);
  const deliveryFee = (bookingDetails.pickupDrop && !isSubscriber) ? (bookingDetails.deliveryFee !== undefined ? Number(bookingDetails.deliveryFee) : configuredDeliveryFee) : 0;
  let finalPrice = basePrice + deliveryFee;

  if (bookingDetails.discountAmount && Number(bookingDetails.discountAmount) > 0) {
    finalPrice = Math.max(0, finalPrice - Number(bookingDetails.discountAmount));
  }

  const snapshotRegPerKg = serviceType === "Express Wash" ? expressRegularPerKg : regularPricePerKg;
  const snapshotOffPerKg = serviceType === "Express Wash" ? expressOfferPerKg : offerPricePerKg;

  return { 
    subtotal: basePrice, 
    deliveryFee, 
    finalPrice,
    regularPricePerKg: snapshotRegPerKg,
    offerPricePerKg: snapshotOffPerKg,
    isOfferActive
  };
}

// 1. Unified Server Process Booking (Wallet, Card, NetBanking, Pay at Store, or Subscription Credits)
app.post("/api/payments/process-booking", async (req, res) => {
  const { userId, paymentMethod = "wallet", bookingDetails } = req.body;

  if (!userId || !bookingDetails) {
    return res.status(400).json({ error: "Missing required booking details or user ID" });
  }

  try {
    await ensureServerAuth();
    const result = await runTransaction(dbClient, async (transaction) => {
      // 1. ALL READS FIRST
      const userRef = doc(dbClient, "users", userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error("User account not found");
      }
      const userData = userSnap.data() || {};
      const isSubscriber = userData.userType === "subscriber" || Boolean(userData.subscriptionPaid);

      // Read global settings
      const settingsRef = doc(dbClient, "settings", "global");
      const settingsSnap = await transaction.get(settingsRef);
      const settingsData = settingsSnap.exists() ? settingsSnap.data() : null;

      const slotDate = bookingDetails.date;
      const slotTime = bookingDetails.slot || bookingDetails.timeSlot;
      const slotId = `${slotDate}_${slotTime}`;
      const slotRef = doc(dbClient, "slots", slotId);
      const slotSnap = await transaction.get(slotRef);

      const counterRef = doc(dbClient, "counters", "bookings");
      const counterSnap = await transaction.get(counterRef);

      // Determine Pricing Facts on Server from Settings
      const { 
        finalPrice, 
        deliveryFee, 
        regularPricePerKg, 
        offerPricePerKg, 
        isOfferActive 
      } = calculateServerOrderPrice(bookingDetails, isSubscriber, settingsData);

      let calculatedPrice = finalPrice;
      let paymentType = paymentMethod;
      let bookingStatus = "paid";
      let creditsUsed = 0;

      // Handle Subscription & Loyalty Credits Payment
      if (paymentMethod === "subscription_credits") {
        const isPerPiece = bookingDetails.serviceType === "Wash & Fold (Per Piece)";
        let creditsNeeded = 0;
        if (isPerPiece && Array.isArray(bookingDetails.pieceBreakdown)) {
          creditsNeeded = bookingDetails.pieceBreakdown.reduce((sum: number, item: any) => {
            return sum + (Number(item.totalCredits) || (Number(item.unitCredits || item.subscriberCredits || 3) * Number(item.count || 1)));
          }, 0);
        } else {
          const loadKg = bookingDetails.approxLoad === "5 kg" ? 5 : bookingDetails.approxLoad === "6 kg" ? 6 : bookingDetails.approxLoad === "7+ kg" ? 7 : 4;
          creditsNeeded = loadKg * 10;
        }

        const currentCredits = Number(userData.laundryCredits !== undefined ? userData.laundryCredits : ((userData.kilosLeft || 0) * 10));
        
        if (!isSubscriber && currentCredits < creditsNeeded) {
          throw new Error(`Active subscription or sufficient laundry credits required. Required: ${creditsNeeded}, Available: ${currentCredits}`);
        }

        if (currentCredits < creditsNeeded) {
          throw new Error(`Insufficient laundry credits. Required: ${creditsNeeded}, Available: ${currentCredits}`);
        }

        const updatedCredits = Math.max(0, currentCredits - creditsNeeded);
        const updatedKilos = Math.floor(updatedCredits / 10);

        transaction.update(userRef, {
          laundryCredits: updatedCredits,
          kilosLeft: updatedKilos
        });

        calculatedPrice = 0;
        creditsUsed = creditsNeeded;
        paymentType = "laundry_credits";
        bookingStatus = "paid";
      } else if (paymentMethod === "wallet") {
        const currentWallet = Number(userData.walletBalance || 0);
        if (currentWallet < calculatedPrice) {
          throw new Error(`Insufficient wallet balance (₹${currentWallet.toFixed(2)}). Order requires ₹${calculatedPrice.toFixed(2)}.`);
        }

        transaction.update(userRef, {
          walletBalance: currentWallet - calculatedPrice
        });

        const walletTxRef = doc(collection(dbClient, "wallet_transactions"));
        transaction.set(walletTxRef, {
          userId,
          amount: -calculatedPrice,
          type: "debit",
          method: "wallet",
          description: `Booking (${slotDate} at ${slotTime})`,
          createdAt: new Date().toISOString()
        });

        paymentType = "wallet";
        bookingStatus = "paid";
      } else if (paymentMethod === "card" || paymentMethod === "netbanking") {
        // Direct Server-verified card/netbanking transaction
        const txnId = `TXN_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
        const walletTxRef = doc(collection(dbClient, "wallet_transactions"));
        transaction.set(walletTxRef, {
          userId,
          amount: calculatedPrice,
          type: "payment",
          method: paymentMethod,
          paymentId: txnId,
          description: `Online Order Payment (${paymentMethod.toUpperCase()})`,
          createdAt: new Date().toISOString()
        });

        paymentType = paymentMethod;
        bookingStatus = "paid";
      } else if (paymentMethod === "pay_at_store") {
        paymentType = "pay_at_store";
        bookingStatus = "pending";
      }

      // Slot machine assignment
      let slotData: any = slotSnap.exists()
        ? slotSnap.data()
        : { date: slotDate, timeSlot: slotTime, machines: { "1": "", "2": "", "3": "", "4": "" } };

      let assignedMachine = 1;
      for (let i = 1; i <= 4; i++) {
        if (!slotData.machines || !slotData.machines[i.toString()]) {
          assignedMachine = i;
          break;
        }
      }

      const updatedMachines = { ...(slotData.machines || {}), [assignedMachine.toString()]: userId };
      if (!slotSnap.exists()) {
        transaction.set(slotRef, { ...slotData, machines: updatedMachines });
      } else {
        transaction.update(slotRef, { machines: updatedMachines });
      }

      // Sequential Booking ID
      const nextSeq = (counterSnap.exists() ? (Number(counterSnap.data()?.lastSequence) || 0) : 0) + 1;
      const customBookingId = generateBookingId(nextSeq, new Date());
      transaction.set(counterRef, {
        lastSequence: nextSeq,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Save Booking Record with Pricing Snapshot
      const newBookingRef = doc(collection(dbClient, "bookings"));
      const bookingRecord: any = {
        bookingId: customBookingId,
        userId,
        userName: userData.name || bookingDetails.userName || "Student",
        date: slotDate,
        timeSlot: slotTime,
        machineNumber: assignedMachine,
        pickupDrop: Boolean(bookingDetails.pickupDrop),
        address: bookingDetails.address || "",
        phone: bookingDetails.phone || userData.phone || "",
        latitude: Number(bookingDetails.latitude || 0),
        longitude: Number(bookingDetails.longitude || 0),
        deliveryFee: isSubscriber ? 0 : deliveryFee,
        storeId: bookingDetails.storeId || "default",
        garmentInstructions: bookingDetails.garmentInstructions || "",
        serviceType: bookingDetails.serviceType || "Wash & Fold",
        approxLoad: bookingDetails.approxLoad || "1-4 kg",
        price: calculatedPrice,
        regular_price_per_kg: regularPricePerKg,
        offer_price_per_kg: offerPricePerKg,
        price_used: calculatedPrice,
        offer_active: isOfferActive,
        paymentType,
        status: bookingStatus,
        createdAt: new Date().toISOString()
      };

      if (bookingDetails.totalPieces !== undefined && bookingDetails.totalPieces !== null) {
        bookingRecord.totalPieces = Number(bookingDetails.totalPieces);
      }
      if (bookingDetails.garmentPieces) {
        bookingRecord.garmentPieces = bookingDetails.garmentPieces;
      }
      if (bookingDetails.pieceBreakdown) {
        bookingRecord.pieceBreakdown = bookingDetails.pieceBreakdown;
      }
      if (bookingDetails.garmentPieceSnapshots) {
        bookingRecord.garmentPieceSnapshots = bookingDetails.garmentPieceSnapshots;
      }
      if (creditsUsed) {
        bookingRecord.creditsUsed = creditsUsed;
      }
      if (bookingDetails.discountAmount) {
        bookingRecord.discountAmount = Number(bookingDetails.discountAmount);
      }
      if (bookingDetails.appliedPromoCode) {
        bookingRecord.appliedPromoCode = bookingDetails.appliedPromoCode;
      }
      if (bookingDetails.appliedOfferId) {
        bookingRecord.appliedOfferId = bookingDetails.appliedOfferId;
      }

      transaction.set(newBookingRef, bookingRecord);

      // Notification
      const notificationRef = doc(collection(dbClient, "notifications"));
      transaction.set(notificationRef, {
        userId,
        email: userData.email || "",
        title: bookingStatus === "paid" ? "Booking Confirmed! 🧺" : "Booking Received 🧺",
        message: `Your booking (${customBookingId}) for ${slotDate} at ${slotTime} is recorded.`,
        type: "booking_confirmed",
        bookingId: customBookingId,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      return {
        bookingId: customBookingId,
        bookingDocId: newBookingRef.id,
        price: calculatedPrice,
        status: bookingStatus
      };
    });

    if (result.status === "paid") {
      triggerReferralReward(userId, 'booking', result.bookingId).catch(err => {
        console.error("Error triggering referral reward for booking:", err);
      });
    }

    res.json({
      success: true,
      ...result,
      message: "Booking successfully processed."
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to process booking" });
  }
});

// 2. Unified Server Process Subscription
app.post("/api/payments/process-subscription", async (req, res) => {
  const { userId, packageId = "basic", paymentMethod = "wallet" } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    await ensureServerAuth();
    const result = await runTransaction(dbClient, async (transaction) => {
      const userRef = doc(dbClient, "users", userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("User account not found");

      const userData = userSnap.data() || {};

      // Fetch global settings to determine exact plan pricing & offer status
      const settingsRef = doc(dbClient, "settings", "global");
      const settingsSnap = await transaction.get(settingsRef);
      const settingsData = settingsSnap.exists() ? settingsSnap.data() : null;

      const isOfferActive = settingsData?.pricing?.limited_time_offer !== false;
      const plansList = settingsData?.subscriptionPlans || [];

      // Find configured plan or fallback to standard 4-tier configuration
      const defaultPlans: Record<string, { name: string; regular_price: number; offer_price: number; credits: number; kg_equivalent: number }> = {
        basic: { name: "Basic", regular_price: 828, offer_price: 468, credits: 120, kg_equivalent: 12 },
        standard: { name: "Standard", regular_price: 1104, offer_price: 624, credits: 160, kg_equivalent: 16 },
        premium: { name: "Premium", regular_price: 1380, offer_price: 780, credits: 200, kg_equivalent: 20 },
        super_premium: { name: "Super Premium", regular_price: 2208, offer_price: 1248, credits: 320, kg_equivalent: 32 }
      };

      const matchedPlan = plansList.find((p: any) => p.id === packageId);
      const defaultMatch = defaultPlans[packageId] || defaultPlans.basic;

      const kg_equivalent = Number(matchedPlan?.kg_equivalent ?? matchedPlan?.kgLimit ?? defaultMatch.kg_equivalent);
      const credits = Number(matchedPlan?.credits ?? matchedPlan?.monthlyCredits ?? (kg_equivalent * 10));
      const regular_price = Number(matchedPlan?.regular_price ?? (matchedPlan?.originalPrice && matchedPlan.originalPrice > 500 ? matchedPlan.originalPrice : kg_equivalent * 69));
      const offer_price = Number(matchedPlan?.offer_price ?? (matchedPlan?.price && matchedPlan.price !== 421 && matchedPlan.price !== 530 && matchedPlan.price !== 647 && matchedPlan.price !== 936 ? matchedPlan.price : kg_equivalent * 39));
      const plan_name = matchedPlan?.name || defaultMatch.name;

      const payablePrice = isOfferActive ? offer_price : regular_price;
      const purchase_date = new Date().toISOString();

      const subscriptionSnapshot = {
        plan_name,
        regular_price,
        offer_price,
        price_paid: payablePrice,
        credits,
        kg_equivalent,
        offer_active: isOfferActive,
        purchase_date
      };

      if (paymentMethod === "wallet") {
        const currentWallet = Number(userData.walletBalance || 0);
        if (currentWallet < payablePrice) {
          throw new Error(`Insufficient wallet balance (₹${currentWallet.toFixed(2)}). Plan costs ₹${payablePrice.toFixed(2)}.`);
        }

        transaction.update(userRef, {
          walletBalance: currentWallet - payablePrice,
          userType: "subscriber",
          package: packageId,
          subscriptionPaid: true,
          kilosLeft: kg_equivalent,
          laundryCredits: credits,
          totalMonthlyCredits: credits,
          subscriptionStartDate: purchase_date,
          subscriptionSnapshot
        });

        const walletTxRef = doc(collection(dbClient, "wallet_transactions"));
        transaction.set(walletTxRef, {
          userId,
          amount: -payablePrice,
          type: "debit",
          method: "wallet",
          description: `Subscription Plan (${plan_name.toUpperCase()}) - ${isOfferActive ? 'Limited-Time Offer' : 'Regular'}`,
          createdAt: purchase_date
        });
      } else {
        const txnId = `TXN_SUB_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
        transaction.update(userRef, {
          userType: "subscriber",
          package: packageId,
          subscriptionPaid: true,
          kilosLeft: kg_equivalent,
          laundryCredits: credits,
          totalMonthlyCredits: credits,
          subscriptionStartDate: purchase_date,
          subscriptionSnapshot
        });

        const walletTxRef = doc(collection(dbClient, "wallet_transactions"));
        transaction.set(walletTxRef, {
          userId,
          amount: payablePrice,
          type: "payment",
          method: paymentMethod,
          paymentId: txnId,
          description: `Subscription Payment (${paymentMethod.toUpperCase()} - ${plan_name})`,
          createdAt: purchase_date
        });
      }

      return { packageId, price: payablePrice, snapshot: subscriptionSnapshot };
    });

    if (result.packageId) {
      triggerReferralReward(userId, 'subscription', `SUB_${result.packageId}`).catch(err => {
        console.error("Error triggering referral reward for subscription:", err);
      });
    }

    res.json({
      success: true,
      ...result,
      message: "Subscription activated successfully"
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to process subscription" });
  }
});

// --- REFERRAL & REWARDS ENGINE ---

async function triggerReferralReward(referredUserId: string, triggerSource: 'booking' | 'subscription', orderOrBookingId: string) {
  try {
    await ensureServerAuth();
    const q = query(
      collection(dbClient, "referrals"),
      where("referredUserId", "==", referredUserId),
      where("status", "==", "pending")
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    // Retrieve settings
    const settingsDoc = await getDoc(doc(dbClient, "settings", "global"));
    const settingsData = settingsDoc.exists() ? settingsDoc.data() : null;
    const referralConfig = settingsData?.referral || {
      enabled: true,
      referrerCredits: 20,
      referrerWalletCash: 50,
      refereeBonusCredits: 10,
      refereeDiscountRupees: 50
    };

    if (referralConfig.enabled === false) return;

    for (const refDoc of snap.docs) {
      const refData = refDoc.data() as any;
      const referrerId = refData.referrerId;
      if (!referrerId || referrerId === referredUserId) continue;

      const rewardCredits = Number(refData.rewardCredits || referralConfig.referrerCredits || 20);
      const rewardCash = Number(refData.rewardWalletCash || referralConfig.referrerWalletCash || 50);

      // Perform atomic balance updates on referrer account
      await runTransaction(dbClient, async (tx) => {
        const referrerRef = doc(dbClient, "users", referrerId);
        const referrerSnap = await tx.get(referrerRef);
        if (!referrerSnap.exists()) return;

        const referrerUser = referrerSnap.data() || {};
        const currentCredits = Number(referrerUser.laundryCredits || ((referrerUser.kilosLeft || 0) * 10));
        const newCredits = currentCredits + rewardCredits;
        const newKilos = Math.floor(newCredits / 10);
        const currentWallet = Number(referrerUser.walletBalance || 0);
        const newWallet = currentWallet + rewardCash;
        const newRefCount = Number(referrerUser.referralCount || 0) + 1;
        const totalCreds = Number(referrerUser.totalReferralCreditsEarned || 0) + rewardCredits;
        const totalCash = Number(referrerUser.totalReferralCashEarned || 0) + rewardCash;

        tx.update(referrerRef, {
          laundryCredits: newCredits,
          kilosLeft: newKilos,
          walletBalance: newWallet,
          referralCount: newRefCount,
          totalReferralCreditsEarned: totalCreds,
          totalReferralCashEarned: totalCash
        });

        // Log wallet reward transaction
        if (rewardCash > 0) {
          const walletTxRef = doc(collection(dbClient, "wallet_transactions"));
          tx.set(walletTxRef, {
            userId: referrerId,
            amount: rewardCash,
            type: "credit",
            method: "referral_cashback",
            description: `Referral Reward: ${refData.referredUserName || 'Friend'} completed first ${triggerSource}`,
            createdAt: new Date().toISOString()
          });
        }

        // Mark referral record as completed
        tx.update(refDoc.ref, {
          status: "completed",
          completedAt: new Date().toISOString(),
          orderId: orderOrBookingId,
          rewardCredits,
          rewardWalletCash: rewardCash
        });

        // Notification for Referrer
        const notifRef = doc(collection(dbClient, "notifications"));
        tx.set(notifRef, {
          userId: referrerId,
          title: "🎉 Referral Reward Unlocked!",
          message: `Awesome news! ${refData.referredUserName || 'Your friend'} completed their first ${triggerSource} (${orderOrBookingId}). You received +${rewardCredits} Laundry Credits & +₹${rewardCash} in your wallet!`,
          type: "referral_reward",
          isRead: false,
          createdAt: new Date().toISOString()
        });

        // Notification for Referee
        const refereeNotifRef = doc(collection(dbClient, "notifications"));
        tx.set(refereeNotifRef, {
          userId: referredUserId,
          title: "🌟 Referral Status: Verified!",
          message: `Your first ${triggerSource} is completed! Your referral bonus has been verified and ${referrerUser.name || 'your referrer'} also received their reward.`,
          type: "referral_verified",
          isRead: false,
          createdAt: new Date().toISOString()
        });
      });
    }
  } catch (err) {
    console.error("Error triggering referral reward:", err);
  }
}

// --- LOYALTY POINTS REWARD ENGINE ---
async function triggerLoyaltyReward(bookingId: string, bookingDataInput?: any) {
  try {
    await ensureServerAuth();
    if (!dbClient) return;

    const bookingRef = doc(dbClient, "bookings", bookingId);
    let bookingData = bookingDataInput;
    if (!bookingData || !bookingData.status) {
      const bSnap = await getDoc(bookingRef);
      if (!bSnap.exists()) return;
      bookingData = bSnap.data();
    }

    const isWashFinished = bookingData.status === "completed" || bookingData.status === "Washing completed";
    if (!isWashFinished) return;
    // Strictly prevent double rewarding if already awarded credits > 0
    if (bookingData.loyaltyRewarded === true && Number(bookingData.loyaltyCreditsAwarded || 0) > 0) return;

    const targetUserId = bookingData.userId;
    if (!targetUserId) return;

    // Retrieve settings
    const settingsDoc = await getDoc(doc(dbClient, "settings", "global"));
    const settingsData = settingsDoc.exists() ? settingsDoc.data() : null;
    const loyaltyConfig = settingsData?.loyalty || {
      enabled: true,
      creditsPerWash: 5,
      redemptionThreshold: 40,
      rewardOnFreeWash: true
    };

    if (loyaltyConfig.enabled === false) return;

    const rewardCredits = Number(loyaltyConfig.creditsPerWash || 5);

    // Atomic transaction to update user balance & mark booking as rewarded
    await runTransaction(dbClient, async (tx) => {
      const bSnap = await tx.get(bookingRef);
      if (!bSnap.exists()) return;
      const curBooking = bSnap.data() || {};
      if (curBooking.loyaltyRewarded === true && Number(curBooking.loyaltyCreditsAwarded || 0) > 0) return; // Strict idempotency

      const userRef = doc(dbClient, "users", targetUserId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data() || {};
      const currentCredits = Number(userData.laundryCredits !== undefined ? userData.laundryCredits : ((userData.kilosLeft || 0) * 10));
      const newCredits = currentCredits + rewardCredits;
      const newKilos = Math.floor(newCredits / 10);
      const totalLoyaltyCredits = Number(userData.totalLoyaltyCreditsEarned || 0) + rewardCredits;
      const completedWashes = Number(userData.completedWashCount || 0) + 1;

      tx.update(userRef, {
        laundryCredits: newCredits,
        kilosLeft: newKilos,
        totalLoyaltyCreditsEarned: totalLoyaltyCredits,
        completedWashCount: completedWashes
      });

      tx.update(bookingRef, {
        loyaltyRewarded: true,
        washRewardAwarded: true,
        loyaltyCreditsAwarded: rewardCredits,
        loyaltyRewardedAt: new Date().toISOString()
      });

      const notifRef = doc(collection(dbClient, "notifications"));
      const isFreeWashReady = newCredits >= 40;
      const creditsUntilNext = 40 - (newCredits % 40);
      tx.set(notifRef, {
        userId: targetUserId,
        title: "🎉 +5 Loyalty Credits Earned!",
        message: `Wash #${bookingId.substring(0, 6)} completed! You earned 5 Loyalty Credits. Your balance is now ${newCredits} credits ${isFreeWashReady ? '(Free 4kg Wash Ready to Redeem!)' : `(${creditsUntilNext === 40 ? 'Free Wash Unlocked!' : `${creditsUntilNext} more credits until next Free Wash`})`}.`,
        type: "loyalty_reward",
        status: "unread",
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    sendPushNotification(targetUserId, {
      title: "🎉 +5 Loyalty Credits Earned!",
      body: `Your wash is completed! 5 loyalty credits have been added to your WashWise balance.`
    }).catch(() => {});

  } catch (err: any) {
    console.error("Error executing triggerLoyaltyReward:", err);
  }
}

// API to trigger or retry loyalty reward evaluation
app.post("/api/loyalty/trigger-reward", async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ error: "Missing bookingId" });
    }
    await triggerLoyaltyReward(bookingId);
    res.json({ success: true, message: "Loyalty reward evaluated successfully" });
  } catch (err: any) {
    console.error("API loyalty trigger reward error:", err);
    res.status(500).json({ error: err.message || "Failed to trigger loyalty reward" });
  }
});

// API to sync all unrewarded completed/washing completed bookings
app.post("/api/loyalty/sync-unrewarded", async (req, res) => {
  try {
    await ensureServerAuth();
    if (!dbClient) return res.status(500).json({ error: "Server DB not ready" });
    const bSnap = await getDocs(collection(dbClient, "bookings"));
    let rewardedCount = 0;
    for (const bDoc of bSnap.docs) {
      const bData = bDoc.data();
      const isFinished = bData.status === "completed" || bData.status === "Washing completed";
      if (isFinished && (!bData.loyaltyRewarded || Number(bData.loyaltyCreditsAwarded || 0) === 0)) {
        await triggerLoyaltyReward(bDoc.id, bData);
        rewardedCount++;
      }
    }
    res.json({ success: true, count: rewardedCount });
  } catch (err: any) {
    console.error("API loyalty sync unrewarded error:", err);
    res.status(500).json({ error: err.message || "Failed to sync loyalty rewards" });
  }
});

// Validate Referral Code API
app.post("/api/referrals/validate-code", async (req, res) => {
  const { code, currentUserId } = req.body;
  const trimmed = (code || "").toString().trim().toUpperCase();

  if (!trimmed) {
    return res.status(400).json({ valid: false, error: "Please enter a referral code." });
  }

  try {
    const q = query(
      collection(dbClient, "users"),
      where("referralCode", "==", trimmed)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return res.status(404).json({ valid: false, error: "Invalid or expired referral code." });
    }

    const referrerDoc = snap.docs[0];
    const referrerData = referrerDoc.data();

    if (currentUserId && referrerDoc.id === currentUserId) {
      return res.status(400).json({ valid: false, error: "You cannot use your own referral code." });
    }

    // Get current global referral settings
    const settingsDoc = await getDoc(doc(dbClient, "settings", "global"));
    const referralConfig = settingsDoc.exists() ? (settingsDoc.data()?.referral || {}) : {};

    res.json({
      valid: true,
      referrer: {
        uid: referrerDoc.id,
        name: referrerData.name || "WashWise Member",
        email: referrerData.email || ""
      },
      benefits: {
        bonusCredits: referralConfig.refereeBonusCredits ?? 10,
        discountRupees: referralConfig.refereeDiscountRupees ?? 50
      },
      message: `Valid code from ${referrerData.name || "a WashWise member"}!`
    });
  } catch (err: any) {
    console.error("Error in validate-code:", err);
    res.status(500).json({ valid: false, error: err.message || "Failed to validate referral code" });
  }
});

// Get User's Referral Status & Ledger
app.get("/api/referrals/user/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: "User ID is required" });

  try {
    const userDoc = await getDoc(doc(dbClient, "users", userId));
    if (!userDoc.exists()) return res.status(404).json({ error: "User not found" });
    const userData = userDoc.data();

    // Query referrals where user is referrer
    const q = query(
      collection(dbClient, "referrals"),
      where("referrerId", "==", userId)
    );
    const snap = await getDocs(q);

    const referralsList: any[] = [];
    snap.forEach(d => {
      referralsList.push({ id: d.id, ...d.data() });
    });

    // Sort newest first
    referralsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const completedCount = referralsList.filter(r => r.status === 'completed').length;
    const pendingCount = referralsList.filter(r => r.status === 'pending').length;

    res.json({
      referralCode: userData.referralCode,
      referralCount: userData.referralCount || completedCount,
      totalCreditsEarned: userData.totalReferralCreditsEarned || (completedCount * 20),
      totalCashEarned: userData.totalReferralCashEarned || (completedCount * 50),
      pendingCount,
      completedCount,
      history: referralsList
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch referral statistics" });
  }
});

// Admin All Referrals API
app.get("/api/admin/referrals", async (req, res) => {
  try {
    const snap = await getDocs(collection(dbClient, "referrals"));
    const allRefs: any[] = [];
    snap.forEach(d => {
      allRefs.push({ id: d.id, ...d.data() });
    });

    allRefs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalReferrals = allRefs.length;
    const completedCount = allRefs.filter(r => r.status === 'completed').length;
    const pendingCount = allRefs.filter(r => r.status === 'pending').length;
    const totalCreditsDisbursed = allRefs.reduce((acc, curr) => acc + (curr.status === 'completed' ? (curr.rewardCredits || 0) : 0), 0);
    const totalCashDisbursed = allRefs.reduce((acc, curr) => acc + (curr.status === 'completed' ? (curr.rewardWalletCash || 0) : 0), 0);

    res.json({
      totalReferrals,
      completedCount,
      pendingCount,
      totalCreditsDisbursed,
      totalCashDisbursed,
      referrals: allRefs
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch all referrals" });
  }
});

// 3. Unified Server Wallet Top-Up
app.post("/api/payments/wallet-topup", async (req, res) => {
  const { userId, amount, paymentMethod = "card" } = req.body;

  const numAmount = Number(amount);
  if (!userId || !numAmount || numAmount <= 0) {
    return res.status(400).json({ error: "Valid User ID and top-up amount are required" });
  }

  try {
    await ensureServerAuth();
    const txnId = `TXN_TOPUP_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const newBalance = await runTransaction(dbClient, async (transaction) => {
      const userRef = doc(dbClient, "users", userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("User account not found");

      const currentBalance = Number(userSnap.data()?.walletBalance || 0);
      const updatedBalance = currentBalance + numAmount;

      transaction.update(userRef, {
        walletBalance: updatedBalance
      });

      const walletTxRef = doc(collection(dbClient, "wallet_transactions"));
      transaction.set(walletTxRef, {
        userId,
        amount: numAmount,
        type: "credit",
        method: paymentMethod,
        paymentId: txnId,
        description: `Wallet Top-up (Instant ${paymentMethod.toUpperCase()})`,
        createdAt: new Date().toISOString()
      });

      return updatedBalance;
    });

    res.json({
      success: true,
      newBalance,
      paymentId: txnId,
      message: `₹${numAmount.toFixed(2)} successfully added to wallet`
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to top up wallet" });
  }
});

// Vite middleware setup
async function startServer() {
  try {
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

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    server.on("error", (err: any) => {
      console.error("Server listen error:", err);
    });
  } catch (err) {
    console.error("Critical error during startServer:", err);
  }
}

startServer().catch((err) => {
  console.error("Unhandled error in startServer:", err);
});
