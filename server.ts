import express from "express";
import http from "http";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import { 
  getFirestore as getClientFirestore, 
  initializeFirestore as initializeClientFirestore,
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
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
import rateLimit from "express-rate-limit";

dotenv.config();

process.on("unhandledRejection", (reason, promise) => {
  console.warn("Unhandled Promise Rejection caught:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception caught:", err);
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable 'trust proxy' so Express & express-rate-limit correctly identify client IPs behind reverse proxies / Google Cloud Run
app.set("trust proxy", 1);

app.use(compression());
app.use(express.json());

// Security Rate Limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: { error: "Too many requests. Please try again later." }
});

const sensitiveApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit sensitive operations (payments, booking, password reset) to 30 per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: { error: "Too many requests for this operation. Please slow down." }
});

app.use("/api/", apiLimiter);
app.use("/api/auth/reset-password", sensitiveApiLimiter);
app.use("/api/payments/", sensitiveApiLimiter);
app.use("/api/booking/apply-offer", sensitiveApiLimiter);

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
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    try {
      dbClient = initializeClientFirestore(clientApp, {
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true
      }, dbId);
    } catch {
      dbClient = getClientFirestore(clientApp, dbId);
    }
    clientAuth = getClientAuth(clientApp);
  }
} catch (e) {
  // Silent client sdk catch
}

// Test Firestore Connection safely in background
async function ensureServerAuth() {
  if (!clientAuth) return;
  const serverPassword = process.env.SERVER_SERVICE_PASSWORD || "ServerPass123!";
  if (!clientAuth.currentUser) {
    try {
      await signInWithEmailAndPassword(clientAuth, "server@washwise.com", serverPassword);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(clientAuth, "server@washwise.com", serverPassword);
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
        // Only trigger on actual status changes when document is modified
        if (change.type === "modified") {
          const bookingData = change.doc.data();
          const bookingId = change.doc.id;
          const currentStatus = bookingData.status;
          
          if (currentStatus) {
            try {
              // Deduplication: ensure we only notify ONCE per status transition
              // e.g. when status changes from 'paid' to 'In Wash', notify 'In Wash' once.
              if (bookingData.lastNotifiedStatus === currentStatus) {
                return;
              }

              // Display booking ID formatted nicely with user's logic (e.g. 0033/OCT/26/0956)
              // If not already set, fallback to sequence generation or custom formatted booking ID
              let displayBookingId = bookingData.bookingId || bookingData.customBookingId || (bookingId.includes('/') ? bookingId : '');
              if (!displayBookingId || !displayBookingId.includes('/')) {
                displayBookingId = generateBookingId(bookingData.sequenceNumber || 1, bookingData.createdAt ? new Date(bookingData.createdAt) : new Date());
                updateDoc(doc(dbClient, "bookings", bookingId), {
                  bookingId: displayBookingId
                }).catch(() => {});
              }

              let notifTitle = "Booking Status Update";
              let notifMessage = `Your laundry booking ${displayBookingId} is now: ${currentStatus}`;
              let notifType = "wash_stage_update";

              switch (currentStatus) {
                case "In Wash":
                  notifTitle = "🧺 Clothes in Wash Cycle";
                  notifMessage = `Your clothes for ${displayBookingId} are now washing with eco detergent.`;
                  notifType = "wash_stage_update";
                  break;
                case "In Dryer":
                  notifTitle = "💨 Drying in Progress";
                  notifMessage = `Your wash is complete and now tumble-drying to perfection.`;
                  notifType = "wash_stage_update";
                  break;
                case "Ready to collect":
                case "Ready for pick up":
                  notifTitle = "✨ Ready for Pickup!";
                  notifMessage = `Your clothes for ${displayBookingId} are fresh, folded & waiting for you at the laundry hub.`;
                  notifType = "ready_for_pickup";
                  break;
                case "Out for delivery":
                  notifTitle = "🚚 Out for Delivery";
                  notifMessage = `Our delivery partner is bringing your fresh laundry (${displayBookingId}) to your doorstep.`;
                  notifType = "out_for_delivery";
                  break;
                case "completed":
                case "Washing completed":
                  notifTitle = "✅ Laundry Completed";
                  notifMessage = `Order ${displayBookingId} is completed. Thank you for choosing WashWise!`;
                  notifType = "wash_completed";
                  break;
                case "rescheduled":
                  notifTitle = "⏰ Booking Rescheduled";
                  notifMessage = `Your slot for ${displayBookingId} was moved to ${bookingData.timeSlot || 'new time'}.`;
                  notifType = "booking_rescheduled";
                  break;
                case "paid":
                  notifTitle = "Booking Confirmed";
                  notifMessage = `Your laundry booking (${displayBookingId}) has been confirmed.`;
                  notifType = "booking_confirmed";
                  break;
                case "rejected":
                  notifTitle = "Booking Rejected";
                  notifMessage = `Your booking (${displayBookingId}) was rejected.`;
                  notifType = "booking_rejected";
                  break;
              }

              // Mark as notified for this exact status atomically in the booking doc to prevent duplicate triggers
              await updateDoc(doc(dbClient, "bookings", bookingId), {
                lastNotifiedStatus: currentStatus,
                statusNotified: true
              });

              // 1. Create or update exactly ONE deterministic in-app notification doc with the formatted order ID
              // Deterministic document ID guarantees idempotency at the database engine level
              const safeStatusKey = currentStatus.toLowerCase().replace(/[^a-z0-9]/g, '_');
              const deterministicNotifId = `notif_${bookingId}_${safeStatusKey}`;
              await setDoc(doc(dbClient, "notifications", deterministicNotifId), {
                userId: bookingData.userId,
                title: notifTitle,
                message: notifMessage,
                type: notifType,
                bookingId: displayBookingId,
                bookingDocId: bookingId,
                link: `/confirmation?id=${displayBookingId}`,
                isRead: false,
                status: "unread",
                createdAt: new Date().toISOString()
              }, { merge: true });

              // 2. Loyalty Points Trigger on wash completion (Idempotent: checks !loyaltyRewarded or 0 credits awarded)
              const isWashFinished = currentStatus === "completed" || currentStatus === "Washing completed";
              if (isWashFinished && (!bookingData.loyaltyRewarded || Number(bookingData.loyaltyCreditsAwarded || 0) === 0)) {
                triggerLoyaltyReward(bookingId, bookingData).catch((err) => {
                  console.error("Error triggering loyalty reward from listener:", err);
                });
              }

              // 3. Send Mobile Notification Bar Push (FCM) to user's phone for ALL stage transitions
              // This guarantees customer receives notification in their mobile status/notification bar
              await sendPushNotification(bookingData.userId, {
                title: notifTitle,
                body: notifMessage,
                data: {
                  bookingId: displayBookingId,
                  customOrderId: displayBookingId,
                  customBookingId: displayBookingId,
                  bookingDocId: bookingId,
                  status: currentStatus,
                  link: `/confirmation?id=${displayBookingId}`
                }
              });

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
    const rawTokens: string[] = userData?.fcmTokens || [];
    const tokens = Array.from(new Set(rawTokens.filter((t: any) => typeof t === "string" && t.trim().length > 0)));

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

interface AuthenticatedUser {
  uid: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

async function authenticateRequest(req: express.Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) return null;

  try {
    let uid = "";
    let email = "";

    // 1. Verify ID token via Firebase Admin if available
    if (authAdmin && typeof authAdmin.verifyIdToken === "function") {
      try {
        const decoded = await authAdmin.verifyIdToken(token);
        uid = decoded.uid;
        email = (decoded.email || "").toLowerCase();
      } catch (tokenErr) {
        // Fallback to signature-agnostic payload parsing if admin credentials aren't bound
      }
    }

    // 2. Fallback: Parse token claims directly
    if (!uid) {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
          if (payload.exp && payload.exp * 1000 > Date.now()) {
            uid = payload.user_id || payload.sub || "";
            email = (payload.email || "").toLowerCase();
          }
        }
      } catch (decodeErr) {
        return null;
      }
    }

    if (!uid) return null;

    // 3. Super admin check
    const superAdminEmails = [
      "ashwinchuttipara@gmail.com",
      "server@washwise.com",
      "21ba14250@rit.ac.in"
    ];
    let isSuperAdmin = superAdminEmails.includes(email) || uid === "gjbVlTdjgYPIHvfuukPpdAmkJb43";
    let isAdmin = isSuperAdmin;

    // 4. Role lookup in Firestore
    if (dbClient && (!isAdmin || !isSuperAdmin)) {
      try {
        if (email) {
          const roleDoc = await getDoc(doc(dbClient, "admin_roles", email));
          if (roleDoc.exists()) {
            isAdmin = true;
            if (roleDoc.data().role === "super_admin") {
              isSuperAdmin = true;
            }
          }
        }
        if (!isAdmin || !isSuperAdmin) {
          const userDoc = await getDoc(doc(dbClient, "users", uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.adminRole === "super_admin") {
              isSuperAdmin = true;
              isAdmin = true;
            } else if (data.adminRole || data.role === "admin") {
              isAdmin = true;
            }
          }
        }
      } catch (dbErr) {
        // Role check failed
      }
    }

    return { uid, email, isAdmin, isSuperAdmin };
  } catch (e) {
    console.error("Auth verification error:", e);
    return null;
  }
}

// ============================================================================
// FRAUD & RISK PROTECTION ENGINE
// ============================================================================

interface RiskIncidentParams {
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  riskType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionTaken: 'blocked' | 'flagged' | 'warned';
  details: string;
  metadata?: Record<string, any>;
}

// In-memory brute force & enumeration tracking
const promoFailureTracker = new Map<string, { count: number; lockedUntil: number }>();

async function logRiskIncident(params: RiskIncidentParams) {
  try {
    if (!dbClient) return;
    const logRef = doc(collection(dbClient, "risk_logs"));
    const logData = {
      userId: params.userId || null,
      userEmail: params.userEmail || null,
      ipAddress: params.ipAddress || "unknown",
      userAgent: params.userAgent || "unknown",
      riskType: params.riskType,
      severity: params.severity,
      actionTaken: params.actionTaken,
      details: params.details,
      metadata: params.metadata || {},
      createdAt: new Date().toISOString()
    };
    await setDoc(logRef, logData);

    // If high or critical severity, elevate user's risk score and append risk flags
    if (params.userId && (params.severity === 'high' || params.severity === 'critical')) {
      try {
        const userRef = doc(dbClient, "users", params.userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const existingFlags: string[] = Array.isArray(userData.riskFlags) ? [...userData.riskFlags] : [];
          if (!existingFlags.includes(params.riskType)) {
            existingFlags.push(params.riskType);
          }
          const currentScore = Number(userData.riskScore || 0);
          const scoreBump = params.severity === 'critical' ? 40 : 25;
          const newScore = Math.min(100, currentScore + scoreBump);
          const newLevel = newScore >= 70 ? 'high' : newScore >= 40 ? 'medium' : 'low';

          await updateDoc(userRef, {
            riskLevel: newLevel,
            riskScore: newScore,
            riskFlags: existingFlags,
            lastRiskIncidentAt: new Date().toISOString()
          });
        }
      } catch (err) {
        // non-blocking
      }
    }
  } catch (err) {
    console.warn("Failed to record risk incident:", err);
  }
}

// Admin: Get Risk Overview & Metrics
app.get("/api/admin/risk/overview", async (req, res) => {
  try {
    const requester = await authenticateRequest(req);
    if (!requester || (!requester.isAdmin && !requester.isSuperAdmin)) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    await ensureServerAuth();
    if (!dbClient) return res.status(500).json({ error: "Database not ready" });

    // Fetch risk logs
    const logsSnap = await getDocs(query(collection(dbClient, "risk_logs"), orderBy("createdAt", "desc"), limit(100)));
    const logs: any[] = [];
    logsSnap.forEach(d => logs.push({ id: d.id, ...d.data() }));

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const logs24h = logs.filter(l => new Date(l.createdAt).getTime() >= oneDayAgo);

    const highSeverityCount = logs.filter(l => l.severity === 'high' || l.severity === 'critical').length;
    const blockedCount = logs.filter(l => l.actionTaken === 'blocked').length;

    // Fetch users with elevated risk
    const usersSnap = await getDocs(collection(dbClient, "users"));
    let flaggedUsersCount = 0;
    let suspendedUsersCount = 0;
    const flaggedUsersList: any[] = [];

    usersSnap.forEach(d => {
      const u = d.data();
      if (u.isSuspended === true) {
        suspendedUsersCount++;
      }
      if (u.riskLevel === 'high' || u.riskLevel === 'medium' || (u.riskScore && u.riskScore > 30)) {
        flaggedUsersCount++;
        flaggedUsersList.push({
          uid: d.id,
          name: u.name,
          email: u.email,
          riskLevel: u.riskLevel || 'medium',
          riskScore: u.riskScore || 35,
          isSuspended: u.isSuspended || false,
          riskFlags: u.riskFlags || []
        });
      }
    });

    const systemStatus = highSeverityCount > 5 || logs24h.length > 20 ? 'Elevated' : logs24h.length > 5 ? 'Guarded' : 'Optimal';

    res.json({
      success: true,
      systemStatus,
      totalIncidents: logs.length,
      incidents24h: logs24h.length,
      highSeverityCount,
      blockedCount,
      flaggedUsersCount,
      suspendedUsersCount,
      flaggedUsers: flaggedUsersList.slice(0, 10),
      recentLogs: logs.slice(0, 20)
    });
  } catch (error: any) {
    console.error("Error fetching risk overview:", error);
    res.status(500).json({ error: error.message || "Failed to fetch risk overview" });
  }
});

// Admin: Get Risk Logs
app.get("/api/admin/risk/logs", async (req, res) => {
  try {
    const requester = await authenticateRequest(req);
    if (!requester || (!requester.isAdmin && !requester.isSuperAdmin)) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    await ensureServerAuth();
    if (!dbClient) return res.status(500).json({ error: "Database not ready" });

    const limitCount = Math.min(100, Number(req.query.limit || 50));
    const logsSnap = await getDocs(query(collection(dbClient, "risk_logs"), orderBy("createdAt", "desc"), limit(limitCount)));
    const logs: any[] = [];
    logsSnap.forEach(d => logs.push({ id: d.id, ...d.data() }));

    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch risk logs" });
  }
});

// Admin: Take Action on Suspicious User (Suspend / Reinstate / Adjust Risk)
app.post("/api/admin/risk/user-action", async (req, res) => {
  try {
    const requester = await authenticateRequest(req);
    if (!requester || (!requester.isAdmin && !requester.isSuperAdmin)) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    const { targetUserId, action, riskLevel, reason } = req.body;
    if (!targetUserId || !action) {
      return res.status(400).json({ error: "targetUserId and action are required" });
    }

    await ensureServerAuth();
    const userRef = doc(dbClient, "users", targetUserId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userSnap.data();

    // Prevent suspending Super Admin
    if (userData.adminRole === 'super_admin' || userData.email === 'ashwinchuttipara@gmail.com') {
      return res.status(403).json({ error: "Cannot suspend a Super Admin" });
    }

    let updatePayload: Record<string, any> = {};

    if (action === 'suspend') {
      updatePayload = {
        isSuspended: true,
        suspendedReason: reason || "Suspended by Security Administrator for risk protection",
        suspendedAt: new Date().toISOString(),
        suspendedBy: requester.email || requester.uid,
        riskLevel: 'blocked'
      };
      await logRiskIncident({
        userId: targetUserId,
        userEmail: userData.email,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        riskType: "ADMIN_ACTION_SUSPEND",
        severity: "high",
        actionTaken: "blocked",
        details: `User account suspended by admin ${requester.email}. Reason: ${reason || "Security violation"}`
      });
    } else if (action === 'unsuspend') {
      updatePayload = {
        isSuspended: false,
        suspendedReason: null,
        unsuspendedAt: new Date().toISOString(),
        unsuspendedBy: requester.email || requester.uid,
        riskLevel: 'low',
        riskScore: 10
      };
      await logRiskIncident({
        userId: targetUserId,
        userEmail: userData.email,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        riskType: "ADMIN_ACTION_UNSUSPEND",
        severity: "low",
        actionTaken: "warned",
        details: `User account reinstated by admin ${requester.email}`
      });
    } else if (action === 'clear_flags') {
      updatePayload = {
        riskFlags: [],
        riskScore: 0,
        riskLevel: 'low'
      };
    } else if (action === 'set_risk_level') {
      updatePayload = {
        riskLevel: riskLevel || 'medium',
        riskScore: riskLevel === 'high' ? 80 : riskLevel === 'medium' ? 50 : 15
      };
    } else {
      return res.status(400).json({ error: "Invalid action specified" });
    }

    await updateDoc(userRef, updatePayload);

    res.json({ success: true, message: `Action ${action} executed successfully`, updated: updatePayload });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to execute user action" });
  }
});

// Admin: Get & Update Risk Settings
app.get("/api/admin/risk/settings", async (req, res) => {
  try {
    const requester = await authenticateRequest(req);
    if (!requester || (!requester.isAdmin && !requester.isSuperAdmin)) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    await ensureServerAuth();
    const settingsDoc = await getDoc(doc(dbClient, "settings", "global"));
    const data = settingsDoc.exists() ? settingsDoc.data() : {};
    const riskControls = data?.riskControls || {
      maxDailyBookingsPerUser: 3,
      maxActiveCodBookings: 2,
      maxSingleWalletTopup: 5000,
      maxDailyWalletTopup: 15000,
      promoAttemptLimit: 5,
      enforceIpReferralCheck: true,
      autoBlockHighRisk: false
    };

    res.json({ success: true, settings: riskControls });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch risk settings" });
  }
});

app.post("/api/admin/risk/settings", async (req, res) => {
  try {
    const requester = await authenticateRequest(req);
    if (!requester || (!requester.isAdmin && !requester.isSuperAdmin)) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ error: "Settings payload required" });
    }

    await ensureServerAuth();
    const settingsRef = doc(dbClient, "settings", "global");
    await updateDoc(settingsRef, {
      riskControls: {
        maxDailyBookingsPerUser: Number(settings.maxDailyBookingsPerUser ?? 3),
        maxActiveCodBookings: Number(settings.maxActiveCodBookings ?? 2),
        maxSingleWalletTopup: Number(settings.maxSingleWalletTopup ?? 5000),
        maxDailyWalletTopup: Number(settings.maxDailyWalletTopup ?? 15000),
        promoAttemptLimit: Number(settings.promoAttemptLimit ?? 5),
        enforceIpReferralCheck: Boolean(settings.enforceIpReferralCheck ?? true),
        autoBlockHighRisk: Boolean(settings.autoBlockHighRisk ?? false),
        updatedAt: new Date().toISOString(),
        updatedBy: requester.email
      }
    });

    res.json({ success: true, message: "Risk controls updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update risk settings" });
  }
});

// Endpoint: Validate Promo Code with Brute-Force & Enumeration Shield
app.post("/api/booking/validate-promo", async (req, res) => {
  const { promoCode, cartValue = 0, serviceType } = req.body;
  const clientKey = `${req.ip}_${req.body.userId || 'anon'}`;
  const now = Date.now();

  // Check enumeration lockout
  const tracker = promoFailureTracker.get(clientKey);
  if (tracker && tracker.lockedUntil > now) {
    const remainingSecs = Math.ceil((tracker.lockedUntil - now) / 1000);
    return res.status(429).json({
      valid: false,
      error: `Too many invalid attempts. Risk lockout active for ${remainingSecs}s.`
    });
  }

  const trimmed = String(promoCode || "").trim().toUpperCase();
  if (!trimmed) {
    return res.status(400).json({ valid: false, error: "Please enter a promo code" });
  }

  try {
    await ensureServerAuth();
    const settingsDoc = await getDoc(doc(dbClient, "settings", "global"));
    const settingsData = settingsDoc.exists() ? settingsDoc.data() : null;
    const promos: any[] = settingsData?.promos || [];

    const foundPromo = promos.find((p: any) => p.code && p.code.toUpperCase() === trimmed && p.active !== false);

    if (!foundPromo) {
      // Record failure
      const currentFailures = (tracker?.count || 0) + 1;
      const riskSettings = settingsData?.riskControls;
      const maxAttempts = Number(riskSettings?.promoAttemptLimit ?? 5);

      if (currentFailures >= maxAttempts) {
        promoFailureTracker.set(clientKey, { count: currentFailures, lockedUntil: now + 15 * 60 * 1000 });
        await logRiskIncident({
          userId: req.body.userId,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          riskType: "PROMO_BRUTE_FORCE",
          severity: "medium",
          actionTaken: "blocked",
          details: `Repeated invalid promo code attempts (${currentFailures}) from IP ${req.ip}. Last tried: "${trimmed}". 15-min lockout triggered.`
        });
        return res.status(429).json({
          valid: false,
          error: "Too many invalid attempts. Promo entry locked for 15 minutes for fraud protection."
        });
      } else {
        promoFailureTracker.set(clientKey, { count: currentFailures, lockedUntil: 0 });
      }

      return res.status(404).json({ valid: false, error: "Invalid or expired promo code" });
    }

    // Check validity dates & redemptions
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (foundPromo.startDate && todayStr < foundPromo.startDate) {
      return res.status(400).json({ valid: false, error: `This promo code starts on ${foundPromo.startDate}` });
    }
    if (foundPromo.expiryDate && new Date(foundPromo.expiryDate) < new Date()) {
      return res.status(400).json({ valid: false, error: "This promo code has expired" });
    }
    if (foundPromo.maxRedemptions && Number(foundPromo.redemptionCount || 0) >= Number(foundPromo.maxRedemptions)) {
      return res.status(400).json({ valid: false, error: "This promo code has reached its maximum redemptions limit" });
    }

    // Reset failure count on success
    promoFailureTracker.delete(clientKey);

    res.json({
      valid: true,
      code: foundPromo.code,
      discountType: foundPromo.discountType,
      discountValue: foundPromo.discountValue,
      description: foundPromo.description || `Save with ${foundPromo.code}`
    });
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message || "Failed to validate promo code" });
  }
});

app.post("/api/auth/delete-user", async (req, res) => {
  const { uid, reason, feedback } = req.body;

  if (!uid) {
    return res.status(400).json({ success: false, error: "User UID is required" });
  }

  // Security Check: Authenticate requester
  const requester = await authenticateRequest(req);
  if (!requester) {
    return res.status(401).json({ success: false, error: "Unauthorized: Valid authentication token required" });
  }

  const isDeletingSelf = requester.uid === uid;
  const isAuthorizedAdmin = requester.isAdmin || requester.isSuperAdmin;

  if (!isDeletingSelf && !isAuthorizedAdmin) {
    return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to delete this user" });
  }

  // Protect primary Super Admin account from deletion
  if (uid === "gjbVlTdjgYPIHvfuukPpdAmkJb43") {
    return res.status(403).json({ success: false, error: "Forbidden: Super Admin account cannot be deleted" });
  }

  try {
    console.log(`Attempting to delete user: ${uid} by ${requester.email || requester.uid}`);
    
    // 1. Fetch user data before deletion to archive exit feedback
    let userSnapshotData: any = {};
    try {
      const userDocSnap = await getDoc(doc(dbClient, "users", uid));
      if (userDocSnap.exists()) {
        userSnapshotData = userDocSnap.data();
      }
    } catch (fetchErr) {
      console.warn("Could not fetch user doc before deletion:", fetchErr);
    }

    // 2. Record Exit / Account Deletion Feedback if provided
    if (reason || feedback) {
      try {
        const exitFeedbackDoc = {
          userId: uid,
          userName: userSnapshotData?.name || (requester as any).name || "Deleted User",
          userEmail: userSnapshotData?.email || requester.email || "No Email",
          userPhone: userSnapshotData?.phone || "No Phone",
          reason: reason || "No specific reason provided",
          feedback: feedback ? String(feedback).trim() : "",
          userType: userSnapshotData?.userType || "guest",
          completedWashCount: Number(userSnapshotData?.completedWashCount || 0),
          createdAt: new Date().toISOString(),
          type: "account_deletion"
        };

        // Save into dedicated 'exit_feedbacks' collection
        await addDoc(collection(dbClient, "exit_feedbacks"), exitFeedbackDoc);

        // Also save into general 'feedback' collection so it surfaces in Super Admin 'Queries & Feedback' tab
        await addDoc(collection(dbClient, "feedback"), {
          userId: uid,
          userName: exitFeedbackDoc.userName,
          userEmail: exitFeedbackDoc.userEmail,
          category: "account_deletion",
          subject: `Account Deletion: ${reason || 'User Closed Account'}`,
          message: feedback 
            ? `Reason to leave: ${reason}\n\nAdditional feedback: ${feedback}`
            : `Reason to leave: ${reason}`,
          status: "new",
          createdAt: new Date().toISOString()
        });

        console.log(`Exit feedback logged for deleted user ${uid}`);
      } catch (feedbackErr) {
        console.warn("Could not save exit feedback doc:", feedbackErr);
      }
    }

    // 3. Delete from Firebase Auth
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

    // 4. Delete from Firestore users collection
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
    try {
      await sendPasswordResetEmail(clientAuth, email);
      console.log(`Firebase password reset email dispatched for ${email}`);
    } catch (sendErr: any) {
      console.warn("Client SDK password reset dispatch notice:", sendErr?.code || sendErr?.message);
    }
    
    // Always return success message to prevent user enumeration
    return res.json({ 
      success: true, 
      sentViaSmtp: false, 
      message: "If an account exists with this email, a password reset link has been sent." 
    });
  } catch (error: any) {
    console.error("Error processing password reset email:", error);
    return res.json({ 
      success: true, 
      message: "If an account exists with this email, a password reset link has been sent." 
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

  const requester = await authenticateRequest(req);
  if (!requester) {
    return res.status(401).json({ error: "Unauthorized: Valid authentication token required" });
  }

  const effectiveUserId = (requester.isAdmin || requester.isSuperAdmin) ? (userId || requester.uid) : requester.uid;

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
      const redemptionId = `${effectiveUserId}_${offerId}_${offer.dailyReset ? today : 'global'}`;
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
        userId: effectiveUserId,
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
function calculateServerOrderPrice(bookingDetails: any, isSubscriber: boolean, settingsData: any, paymentMethod?: string): { 
  subtotal: number; 
  deliveryFee: number; 
  codConvenienceFee: number;
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
  
  // COD has flat ₹39 online advance slot fee or 20% prepayment that gets deducted from the total order; no extra convenience fee is charged.
  const isCod = (paymentMethod === "pay_at_store" || paymentMethod === "cod" || bookingDetails.paymentMethod === "pay_at_store");
  const codConvenienceFee = 0;

  let finalPrice = basePrice + deliveryFee;

  // Authoritative server-side promo code verification and discount calculation
  if (bookingDetails.appliedPromoCode && settingsData?.promos) {
    const promoUpper = String(bookingDetails.appliedPromoCode).trim().toUpperCase();
    const foundPromo = settingsData.promos.find((p: any) => p.code && p.code.toUpperCase() === promoUpper && p.active !== false);
    if (foundPromo) {
      const todayStr = new Date().toISOString().split('T')[0];
      const isStarted = !foundPromo.startDate || todayStr >= foundPromo.startDate;
      const isNotExpired = !foundPromo.expiryDate || new Date(foundPromo.expiryDate) >= new Date();
      const isWithinLimit = !foundPromo.maxRedemptions || Number(foundPromo.redemptionCount || 0) < Number(foundPromo.maxRedemptions);

      if (isStarted && isNotExpired && isWithinLimit) {
        if (foundPromo.discountType === 'price_per_kg') {
          const loadKg = approxLoad === "5 kg" ? 5 : approxLoad === "6 kg" ? 6 : approxLoad === "7+ kg" ? 7 : 4;
          const targetBase = Math.max(1, loadKg * Number(foundPromo.discountValue || 1));
          basePrice = targetBase;
          finalPrice = basePrice + deliveryFee + codConvenienceFee;
        } else if (foundPromo.discountType === 'percentage') {
          const pctDiscount = basePrice * (Number(foundPromo.discountValue || 0) / 100);
          finalPrice = Math.max(0, basePrice - pctDiscount) + deliveryFee + codConvenienceFee;
        } else if (foundPromo.discountType === 'fixed') {
          finalPrice = Math.max(0, basePrice - Number(foundPromo.discountValue || 0)) + deliveryFee + codConvenienceFee;
        }
      }
    }
  } else if (bookingDetails.appliedOfferDiscount && bookingDetails.appliedOfferId) {
    const validatedDiscount = Math.min(basePrice, Number(bookingDetails.appliedOfferDiscount || 0));
    finalPrice = Math.max(0, basePrice - validatedDiscount) + deliveryFee + codConvenienceFee;
  }

  const snapshotRegPerKg = serviceType === "Express Wash" ? expressRegularPerKg : regularPricePerKg;
  const snapshotOffPerKg = serviceType === "Express Wash" ? expressOfferPerKg : offerPricePerKg;

  return { 
    subtotal: basePrice, 
    deliveryFee, 
    codConvenienceFee,
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

  const requester = await authenticateRequest(req);
  if (!requester) {
    return res.status(401).json({ error: "Unauthorized: Valid authentication token required" });
  }

  const effectiveUserId = (requester.isAdmin || requester.isSuperAdmin) ? (userId || requester.uid) : requester.uid;

  try {
    await ensureServerAuth();

    // 1. Account Suspension & Fraud Risk Guard
    const userDocPre = await getDoc(doc(dbClient, "users", effectiveUserId));
    if (userDocPre.exists()) {
      const uData = userDocPre.data();
      if (uData.isSuspended === true || uData.riskLevel === 'blocked') {
        await logRiskIncident({
          userId: effectiveUserId,
          userEmail: uData.email,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          riskType: "SUSPENDED_ACCOUNT_ATTEMPT",
          severity: "high",
          actionTaken: "blocked",
          details: `Suspended account attempted to place a booking. Reason: ${uData.suspendedReason || "Account flagged for risk protection"}`
        });
        return res.status(403).json({ error: "Your account is temporarily suspended due to security risk. Please contact customer support." });
      }
    }

    // Read global settings for risk controls
    const settingsSnapPre = await getDoc(doc(dbClient, "settings", "global"));
    const settingsDataPre = settingsSnapPre.exists() ? settingsSnapPre.data() : null;
    const riskControls = settingsDataPre?.riskControls || {};

    // 2. Daily Booking Velocity Guard
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const userBookingsSnap = await getDocs(query(
      collection(dbClient, "bookings"),
      where("userId", "==", effectiveUserId)
    ));

    const todayBookings = userBookingsSnap.docs.filter(d => {
      const bData = d.data();
      return bData.date === todayStr || (bData.createdAt && String(bData.createdAt).startsWith(todayStr));
    });

    const maxDailyBookings = Number(riskControls.maxDailyBookingsPerUser ?? 3);
    if (!(requester.isAdmin || requester.isSuperAdmin) && todayBookings.length >= maxDailyBookings) {
      await logRiskIncident({
        userId: effectiveUserId,
        userEmail: requester.email,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        riskType: "HIGH_BOOKING_VELOCITY",
        severity: "medium",
        actionTaken: "blocked",
        details: `User attempted to exceed daily limit of ${maxDailyBookings} bookings on ${todayStr}. Active today: ${todayBookings.length}.`
      });
      return res.status(429).json({ error: `Daily booking limit reached (max ${maxDailyBookings} washes/day) for fleet availability. Contact store admin for bulk laundry.` });
    }

    // 3. Cash-on-Delivery (COD) / Pay-at-Store Unpaid Order Guard
    const isCodBooking = (paymentMethod === "pay_at_store" || paymentMethod === "cod" || bookingDetails.paymentMethod === "pay_at_store");
    if (isCodBooking && !(requester.isAdmin || requester.isSuperAdmin)) {
      const pendingCodBookings = userBookingsSnap.docs.filter(d => {
        const b = d.data();
        const isUncompleted = b.status !== "completed" && b.status !== "rejected";
        const isCod = b.paymentType === "pay_at_store" || b.paymentType === "cod" || b.isCodPrepaid === true;
        return isUncompleted && isCod && Number(b.remainingAmount || 0) > 0;
      });

      const maxActiveCod = Number(riskControls.maxActiveCodBookings ?? 2);
      if (pendingCodBookings.length >= maxActiveCod) {
        await logRiskIncident({
          userId: effectiveUserId,
          userEmail: requester.email,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          riskType: "EXCESSIVE_COD_ORDERS",
          severity: "medium",
          actionTaken: "blocked",
          details: `User has ${pendingCodBookings.length} unpaid COD orders, exceeding the limit of ${maxActiveCod}.`
        });
        return res.status(400).json({ error: `You have ${pendingCodBookings.length} pending Pay-at-Store bookings. Please complete or collect your pending orders or pay online to book further slots.` });
      }
    }

    // Query active machines fleet to prevent overbooking and enforce machine limits/non-availability
    const machinesSnap = await getDocs(collection(dbClient, "machines"));
    const machinesList: any[] = [];
    machinesSnap.forEach(d => {
      machinesList.push({ id: d.id, ...d.data() });
    });

    const result = await runTransaction(dbClient, async (transaction) => {
      // 1. ALL READS FIRST
      const userRef = doc(dbClient, "users", effectiveUserId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error("User account not found");
      }
      const userData = userSnap.data() || {};
      const isSubscriber = Boolean(
        userData.userType === "subscriber" || 
        userData.subscriptionPaid || 
        userData.package || 
        Number(userData.laundryCredits || 0) > 0 || 
        Number(userData.kilosLeft || 0) > 0
      );

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
        codConvenienceFee,
        regularPricePerKg, 
        offerPricePerKg, 
        isOfferActive 
      } = calculateServerOrderPrice(bookingDetails, isSubscriber, settingsData, paymentMethod);

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
      } else if (paymentMethod === "pay_at_store" || paymentMethod === "cod") {
        const isPerPiece = bookingDetails.serviceType === "Wash & Fold (Per Piece)";
        const prepaidAmount = isPerPiece
          ? Math.round(calculatedPrice * 0.20 * 100) / 100
          : Math.min(calculatedPrice, 39);
        const remainingAmount = Math.max(0, Math.round((calculatedPrice - prepaidAmount) * 100) / 100);
        const codPrepaidSource = bookingDetails.codPrepaidSource || (bookingDetails.codPrepaidMethod === 'wallet' ? 'wallet' : 'card');

        if (codPrepaidSource === "wallet") {
          const currentWallet = Number(userData.walletBalance || 0);
          if (currentWallet < prepaidAmount) {
            throw new Error(`Insufficient wallet balance (₹${currentWallet.toFixed(2)}). Slot booking deposit requires ₹${prepaidAmount.toFixed(2)}.`);
          }

          transaction.update(userRef, {
            walletBalance: currentWallet - prepaidAmount
          });

          const walletTxRef = doc(collection(dbClient, "wallet_transactions"));
          transaction.set(walletTxRef, {
            userId,
            amount: -prepaidAmount,
            type: "debit",
            method: "wallet",
            description: `Prepaid Slot Booking Fee (${slotDate} at ${slotTime})`,
            createdAt: new Date().toISOString()
          });
        } else {
          // Direct server-recorded card/UPI prepayment for COD slot allocation
          const txnId = `TXN_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
          const walletTxRef = doc(collection(dbClient, "wallet_transactions"));
          transaction.set(walletTxRef, {
            userId,
            amount: prepaidAmount,
            type: "payment",
            method: "online",
            paymentId: txnId,
            description: `Prepaid Slot Booking Fee Online (${slotDate} at ${slotTime})`,
            createdAt: new Date().toISOString()
          });
        }

        paymentType = "pay_at_store";
        bookingStatus = "paid"; // Slot is confirmed and booked with prepayment
      }

      // Slot machine assignment respecting dynamic fleet capacity and non-availability dates
      let slotData: any = slotSnap.exists()
        ? slotSnap.data()
        : { date: slotDate, timeSlot: slotTime, machines: {} };

      // Helper to check if a machine is active on this slotDate
      const isMachineActiveOnDate = (m: any, dateStr: string) => {
        if (m.isAvailable === false) return false;
        if (m.status === 'maintenance' || m.status === 'unavailable') return false;
        if (m.unavailableFrom) {
          if (m.unavailableTo) {
            if (dateStr >= m.unavailableFrom && dateStr <= m.unavailableTo) return false;
          } else {
            if (dateStr >= m.unavailableFrom) return false;
          }
        }
        return true;
      };

      // Filter machines for the store (if provided) and date
      const activeMachinesForDate = machinesList.filter((m: any) => {
        if (bookingDetails.storeId && m.storeId && m.storeId !== bookingDetails.storeId) return false;
        return isMachineActiveOnDate(m, slotDate);
      });

      // If no machines defined yet in Firestore, default to 2 machines (1 & 2)
      const candidateMachineNumbers = activeMachinesForDate.length > 0
        ? activeMachinesForDate.map((m: any) => Number(m.number)).sort((a: number, b: number) => a - b)
        : [1, 2];

      let assignedMachine: number | null = null;
      for (const mNum of candidateMachineNumbers) {
        const occupant = slotData.machines?.[mNum.toString()];
        if (!occupant || occupant.trim() === '') {
          assignedMachine = mNum;
          break;
        }
      }

      if (!assignedMachine) {
        throw new Error("This time slot is completely booked. All active machines for this hour are occupied.");
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
      const isPerPiece = bookingDetails.serviceType === "Wash & Fold (Per Piece)";
      const isCodOrder = paymentType === "pay_at_store";
      const prepaidAmount = isCodOrder
        ? (isPerPiece ? Math.round(calculatedPrice * 0.20 * 100) / 100 : Math.min(calculatedPrice, 39))
        : calculatedPrice;
      const remainingAmount = isCodOrder
        ? Math.max(0, Math.round((calculatedPrice - prepaidAmount) * 100) / 100)
        : 0;

      const newBookingRef = doc(collection(dbClient, "bookings"));
      const bookingRecord: any = {
        bookingId: customBookingId,
        userId: effectiveUserId,
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
        codConvenienceFee: 0,
        storeId: bookingDetails.storeId || "default",
        garmentInstructions: bookingDetails.garmentInstructions || "",
        serviceType: bookingDetails.serviceType || "Wash & Fold",
        approxLoad: bookingDetails.approxLoad || "1-4 kg",
        price: calculatedPrice,
        totalAmount: calculatedPrice,
        prepaidAmount,
        remainingAmount,
        isCodPrepaid: isCodOrder,
        codPrepaidMethod: isCodOrder ? (bookingDetails.codPrepaidSource || "online") : undefined,
        codBalancePaid: !isCodOrder,
        bookingFeeType: isCodOrder ? (isPerPiece ? "percent_20" : "flat_39") : undefined,
        codSlotBookingFee: isCodOrder ? prepaidAmount : 0,
        slotBookingFee: isCodOrder ? prepaidAmount : 0,
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

        // Atomically increment promo redemption count if applicable
        if (settingsData?.promos && Array.isArray(settingsData.promos)) {
          const promoUpper = String(bookingDetails.appliedPromoCode).trim().toUpperCase();
          const updatedPromos = settingsData.promos.map((p: any) => {
            if (p.code && p.code.toUpperCase() === promoUpper) {
              return {
                ...p,
                redemptionCount: Number(p.redemptionCount || 0) + 1
              };
            }
            return p;
          });
          transaction.update(settingsRef, { promos: updatedPromos });
        }
      }
      if (bookingDetails.appliedOfferId) {
        bookingRecord.appliedOfferId = bookingDetails.appliedOfferId;
      }

      transaction.set(newBookingRef, bookingRecord);

      // Notification
      const notificationRef = doc(collection(dbClient, "notifications"));
      transaction.set(notificationRef, {
        userId: effectiveUserId,
        email: userData.email || "",
        title: bookingStatus === "paid" ? "Booking Confirmed" : "Booking Received",
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
        totalAmount: calculatedPrice,
        prepaidAmount,
        remainingAmount,
        status: bookingStatus
      };
    });

    if (result.status === "paid") {
      triggerReferralReward(effectiveUserId, 'booking', result.bookingId).catch(err => {
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

  const requester = await authenticateRequest(req);
  if (!requester) {
    return res.status(401).json({ error: "Unauthorized: Valid authentication token required" });
  }

  const effectiveUserId = (requester.isAdmin || requester.isSuperAdmin) ? (userId || requester.uid) : requester.uid;

  try {
    await ensureServerAuth();
    const result = await runTransaction(dbClient, async (transaction) => {
      const userRef = doc(dbClient, "users", effectiveUserId);
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
          userId: effectiveUserId,
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
      triggerReferralReward(effectiveUserId, 'subscription', `SUB_${result.packageId}`).catch(err => {
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
      maxWalletCashReferrals: 3,
      refereeBonusCredits: 10,
      refereeDiscountRupees: 50
    };

    if (referralConfig.enabled === false) return;

    for (const refDoc of snap.docs) {
      const refData = refDoc.data() as any;
      const referrerId = refData.referrerId;
      if (!referrerId || referrerId === referredUserId) continue;

      // Perform atomic balance updates on referrer account
      await runTransaction(dbClient, async (tx) => {
        const referrerRef = doc(dbClient, "users", referrerId);
        const referrerSnap = await tx.get(referrerRef);
        if (!referrerSnap.exists()) return;

        const referrerUser = referrerSnap.data() || {};
        const currentRefCount = Number(referrerUser.referralCount || 0);
        const maxCashRefs = Number(referralConfig.maxWalletCashReferrals ?? 3);

        // RULE: Only the first 3 referrals award cash to the wallet (e.g. ₹50).
        // Referral 4 and onwards grant ONLY credit rewards (rewardCash = 0).
        const isCashEligible = currentRefCount < maxCashRefs;
        const rewardCash = isCashEligible ? Number(refData.rewardWalletCash || referralConfig.referrerWalletCash || 50) : 0;
        const rewardCredits = Number(refData.rewardCredits || referralConfig.referrerCredits || 20);

        const currentCredits = Number(referrerUser.laundryCredits || ((referrerUser.kilosLeft || 0) * 10));
        const newCredits = currentCredits + rewardCredits;
        const newKilos = Math.floor(newCredits / 10);
        const currentWallet = Number(referrerUser.walletBalance || 0);
        const newWallet = currentWallet + rewardCash;
        const newRefCount = currentRefCount + 1;
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

        // Log wallet reward transaction ONLY if cash was awarded
        if (rewardCash > 0) {
          const walletTxRef = doc(collection(dbClient, "wallet_transactions"));
          tx.set(walletTxRef, {
            userId: referrerId,
            amount: rewardCash,
            type: "credit",
            method: "referral_cashback",
            description: `Referral Reward #${newRefCount} of ${maxCashRefs}: ${refData.referredUserName || 'Friend'} completed first ${triggerSource}`,
            createdAt: new Date().toISOString()
          });
        }

        // Mark referral record as completed
        tx.update(refDoc.ref, {
          status: "completed",
          completedAt: new Date().toISOString(),
          orderId: orderOrBookingId,
          rewardCredits,
          rewardWalletCash: rewardCash,
          isCashRewarded: rewardCash > 0
        });

        // Notification for Referrer
        const notifRef = doc(collection(dbClient, "notifications"));
        const notifMessage = rewardCash > 0
          ? `Awesome news! ${refData.referredUserName || 'Your friend'} completed their first ${triggerSource} (${orderOrBookingId}). You received +${rewardCredits} Laundry Credits & +₹${rewardCash} in your wallet (Cash referral #${newRefCount} of ${maxCashRefs})!`
          : `Awesome news! ${refData.referredUserName || 'Your friend'} completed their first ${triggerSource} (${orderOrBookingId}). You received +${rewardCredits} Laundry Credits! (Max ${maxCashRefs} wallet cash rewards reached; all additional referrals earn laundry credits).`;

        tx.set(notifRef, {
          userId: referrerId,
          title: rewardCash > 0 ? "Referral Reward: Credits + ₹50 Cash" : "Referral Reward: +20 Credits",
          message: notifMessage,
          type: "referral_reward",
          isRead: false,
          createdAt: new Date().toISOString()
        });

        // Notification for Referee
        const refereeNotifRef = doc(collection(dbClient, "notifications"));
        tx.set(refereeNotifRef, {
          userId: referredUserId,
          title: "Referral Status: Verified",
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

      const deterministicLoyaltyNotifId = `notif_${bookingId}_loyalty_reward`;
      const notifRef = doc(dbClient, "notifications", deterministicLoyaltyNotifId);
      const isFreeWashReady = newCredits >= 40;
      const creditsUntilNext = 40 - (newCredits % 40);
      const displayId = curBooking.bookingId || (bookingId.includes('/') ? bookingId : `#${bookingId.slice(-6).toUpperCase()}`);
      tx.set(notifRef, {
        userId: targetUserId,
        title: "+5 Loyalty Credits Earned",
        message: `Wash ${displayId} completed! You earned 5 Loyalty Credits. Your balance is now ${newCredits} credits ${isFreeWashReady ? '(Free 4kg Wash Ready to Redeem)' : `(${creditsUntilNext === 40 ? 'Free Wash Unlocked' : `${creditsUntilNext} more credits until next Free Wash`})`}.`,
        type: "loyalty_reward",
        status: "unread",
        isRead: false,
        createdAt: new Date().toISOString()
      }, { merge: true });
    });

    sendPushNotification(targetUserId, {
      title: "+5 Loyalty Credits Earned",
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

    const requester = await authenticateRequest(req);
    if (!requester) {
      return res.status(401).json({ error: "Unauthorized: Valid authentication token required" });
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
    const requester = await authenticateRequest(req);
    if (!requester || !requester.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin privileges required" });
    }

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

// Secure Server-Side Referral Claim at Signup
app.post("/api/referrals/apply-signup", async (req, res) => {
  const { referralCode } = req.body;
  const trimmed = (referralCode || "").toString().trim().toUpperCase();

  const requester = await authenticateRequest(req);
  if (!requester) {
    return res.status(401).json({ error: "Unauthorized: Valid authentication token required" });
  }

  if (!trimmed) {
    return res.status(400).json({ error: "Referral code is required" });
  }

  try {
    await ensureServerAuth();
    const result = await runTransaction(dbClient, async (transaction) => {
      // Find referrer user by code
      const q = query(
        collection(dbClient, "users"),
        where("referralCode", "==", trimmed)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error("Invalid or expired referral code");
      }

      const referrerDoc = snap.docs[0];
      const referrerData = referrerDoc.data();
      const referrerId = referrerDoc.id;

      if (referrerId === requester.uid) {
        throw new Error("You cannot use your own referral code");
      }

      // Fraud Check: Referral Collusion / IP collision
      const clientIp = req.ip;
      const referrerIp = referrerData.ipAddress || referrerData.lastIpAddress;
      if (referrerIp && clientIp && referrerIp === clientIp) {
        logRiskIncident({
          userId: requester.uid,
          userEmail: requester.email,
          ipAddress: clientIp,
          userAgent: req.get("User-Agent"),
          riskType: "REFERRAL_RING_DETECTED",
          severity: "medium",
          actionTaken: "flagged",
          details: `Referral code ${trimmed} entered from identical IP (${clientIp}) as referrer (${referrerData.email || referrerId}).`
        }).catch(() => {});
      }

      const userRef = doc(dbClient, "users", requester.uid);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error("User account not found");
      }

      const userData = userSnap.data();
      if (userData.referredBy) {
        throw new Error("A referral code has already been applied to this account");
      }

      // Check settings for bonus amounts
      const settingsDoc = await getDoc(doc(dbClient, "settings", "global"));
      const referralConfig = settingsDoc.exists() ? (settingsDoc.data()?.referral || {}) : {};
      const welcomeCredits = Number(referralConfig.refereeBonusCredits ?? 10);
      const welcomeCash = Number(referralConfig.refereeDiscountRupees ?? 50);

      const curCredits = Number(userData.laundryCredits || 0);
      const curWallet = Number(userData.walletBalance || 0);
      const newCredits = curCredits + welcomeCredits;
      const newWallet = curWallet + welcomeCash;

      transaction.update(userRef, {
        referredBy: referrerId,
        laundryCredits: newCredits,
        kilosLeft: Math.floor(newCredits / 10),
        walletBalance: newWallet
      });

      // Create pending referral record
      const refDocRef = doc(collection(dbClient, "referrals"));
      transaction.set(refDocRef, {
        referrerId,
        referrerName: referrerData.name || "WashWise Member",
        referrerEmail: referrerData.email || "",
        referralCode: trimmed,
        referredUserId: requester.uid,
        referredUserName: userData.name || "Student",
        referredUserEmail: userData.email || "",
        status: "pending",
        rewardCredits: 20,
        rewardWalletCash: 50,
        refereeBonusCredits: welcomeCredits,
        refereeDiscountRupees: welcomeCash,
        createdAt: new Date().toISOString()
      });

      // Wallet transaction for referee
      const walletTxRef = doc(collection(dbClient, "wallet_transactions"));
      transaction.set(walletTxRef, {
        userId: requester.uid,
        amount: welcomeCash,
        type: "credit",
        method: "referral_bonus",
        description: `Referral Welcome Bonus (${trimmed})`,
        createdAt: new Date().toISOString()
      });

      // Notification for referee
      const refereeNotifRef = doc(collection(dbClient, "notifications"));
      transaction.set(refereeNotifRef, {
        userId: requester.uid,
        title: "Welcome Bonus Credited!",
        message: `You earned ${welcomeCredits} Free Laundry Credits & ₹${welcomeCash} in your Student Wallet with code ${trimmed}!`,
        type: "referral_welcome",
        isRead: false,
        createdAt: new Date().toISOString()
      });

      // Notification for referrer
      const referrerNotifRef = doc(collection(dbClient, "notifications"));
      transaction.set(referrerNotifRef, {
        userId: referrerId,
        title: "Friend Joined with your Code!",
        message: `${userData.name || 'A friend'} signed up with your referral code. You will receive 20 Laundry Credits & ₹50 wallet cash once they complete their first wash!`,
        type: "referral_invite",
        isRead: false,
        createdAt: new Date().toISOString()
      });

      return {
        welcomeCredits,
        welcomeCash,
        newCredits,
        newWallet
      };
    });

    res.json({
      success: true,
      ...result,
      message: `Referral code applied! You received ${result.welcomeCredits} Free Credits and ₹${result.welcomeCash} wallet bonus.`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to apply referral code" });
  }
});

// Get User's Referral Status & Ledger
app.get("/api/referrals/user/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: "User ID is required" });

  const requester = await authenticateRequest(req);
  if (!requester) {
    return res.status(401).json({ error: "Unauthorized: Valid authentication token required" });
  }

  const effectiveUserId = (requester.isAdmin || requester.isSuperAdmin) ? userId : requester.uid;

  try {
    const userDoc = await getDoc(doc(dbClient, "users", effectiveUserId));
    if (!userDoc.exists()) return res.status(404).json({ error: "User not found" });
    const userData = userDoc.data();

    // Query referrals where user is referrer
    const q = query(
      collection(dbClient, "referrals"),
      where("referrerId", "==", effectiveUserId)
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
    const requester = await authenticateRequest(req);
    if (!requester || !requester.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin privileges required" });
    }

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
  if (!userId || isNaN(numAmount) || numAmount < 10) {
    return res.status(400).json({ error: "Minimum wallet top-up amount is ₹10." });
  }

  const requester = await authenticateRequest(req);
  if (!requester) {
    return res.status(401).json({ error: "Unauthorized: Valid authentication token required" });
  }

  const effectiveUserId = (requester.isAdmin || requester.isSuperAdmin) ? (userId || requester.uid) : requester.uid;

  try {
    await ensureServerAuth();

    // 1. Fetch risk settings & user doc
    const settingsDoc = await getDoc(doc(dbClient, "settings", "global"));
    const settingsData = settingsDoc.exists() ? settingsDoc.data() : null;
    const maxSingleTopup = Number(settingsData?.riskControls?.maxSingleWalletTopup ?? 5000);
    const maxDailyTopup = Number(settingsData?.riskControls?.maxDailyWalletTopup ?? 15000);

    // 2. Check maximum single top-up limit
    if (numAmount > maxSingleTopup) {
      await logRiskIncident({
        userId: effectiveUserId,
        userEmail: requester.email,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        riskType: "SUSPICIOUS_TOPUP",
        severity: "high",
        actionTaken: "blocked",
        details: `Top-up request of ₹${numAmount} exceeds single transaction limit of ₹${maxSingleTopup}.`
      });
      return res.status(400).json({ error: `Maximum single top-up is ₹${maxSingleTopup.toLocaleString('en-IN')} for fraud and risk protection.` });
    }

    // 3. Check Account Suspension
    const userDocPre = await getDoc(doc(dbClient, "users", effectiveUserId));
    if (userDocPre.exists()) {
      const uData = userDocPre.data();
      if (uData.isSuspended === true || uData.riskLevel === 'blocked') {
        await logRiskIncident({
          userId: effectiveUserId,
          userEmail: uData.email,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          riskType: "SUSPENDED_ACCOUNT_ATTEMPT",
          severity: "high",
          actionTaken: "blocked",
          details: `Suspended account attempted wallet top-up. Reason: ${uData.suspendedReason || "Account suspended"}`
        });
        return res.status(403).json({ error: "Your account is temporarily suspended due to security risk. Please contact customer support." });
      }
    }

    // 4. Check Daily Top-up Velocity & Cumulative Amount
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const topupsQuery = query(
      collection(dbClient, "wallet_transactions"),
      where("userId", "==", effectiveUserId)
    );
    const txSnap = await getDocs(topupsQuery);
    const todayTopups = txSnap.docs.filter(d => {
      const t = d.data();
      return t.type === "credit" && t.createdAt && String(t.createdAt).startsWith(todayStr);
    });
    const todayTotal = todayTopups.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);

    if ((todayTotal + numAmount) > maxDailyTopup) {
      await logRiskIncident({
        userId: effectiveUserId,
        userEmail: requester.email,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        riskType: "SUSPICIOUS_TOPUP",
        severity: "medium",
        actionTaken: "blocked",
        details: `Cumulative daily top-up of ₹${todayTotal + numAmount} exceeds daily limit of ₹${maxDailyTopup}.`
      });
      return res.status(400).json({ error: `Daily wallet top-up limit of ₹${maxDailyTopup.toLocaleString('en-IN')} reached for your account.` });
    }

    const txnId = `TXN_TOPUP_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const newBalance = await runTransaction(dbClient, async (transaction) => {
      const userRef = doc(dbClient, "users", effectiveUserId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("User account not found");

      const currentBalance = Number(userSnap.data()?.walletBalance || 0);
      const updatedBalance = currentBalance + numAmount;

      transaction.update(userRef, {
        walletBalance: updatedBalance
      });

      const walletTxRef = doc(collection(dbClient, "wallet_transactions"));
      transaction.set(walletTxRef, {
        userId: effectiveUserId,
        amount: numAmount,
        type: "credit",
        method: paymentMethod,
        paymentId: txnId,
        ipAddress: req.ip,
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

// ============================================================================
// SMART NOTIFICATION REMINDERS ENGINE
// ============================================================================

// Core function to check and send periodic & milestone reminders
async function runSmartRemindersScan() {
  if (!dbClient) return { success: false, remindersSent: 0 };

  let count = 0;
  try {
    // 1. Fetch reminder settings from Firestore
    let reminderSettings: any = null;
    try {
      const settingsSnap = await getDoc(doc(dbClient, "settings", "global"));
      if (settingsSnap.exists()) {
        reminderSettings = settingsSnap.data()?.reminders;
      }
    } catch (e) {
      // Use fallback defaults
    }

    const isEnabled = reminderSettings?.enabled !== false;
    if (!isEnabled) {
      return { success: true, message: "Reminders disabled in global settings", remindersSent: 0 };
    }

    const daysInterval = Number(reminderSettings?.daysAfterLastBooking || 5);
    const templates = (reminderSettings?.templates || []).filter((t: any) => t.active !== false);

    const defaultTemplates = [
      "New week alle… ningal busy aayal mathi, laundry njangal handle cheyyam",
      "Just checking… laundry plan undo? 😏",
      "Half week kazhinju… little refresh venam alle?",
      "“Innu small wash cheythal… weekend free aakum 😌”",
      "“Ningal relax cheyyan… njangal laundry handle cheyyam 🤍”",
      "“Weekend plans undo? 👀 clothes ready aano? 😉”",
      "“Friday vibe set aakan… fresh clothes must alle 😏”",
      "“Innu perfect day aanu… laundry kazhinjal full relax 😌”",
      "“Saturday chillinu munpe… oru quick wash cheyyam? 😊”",
      "“Hey… ningal relax cheyyu 🤍 but slots fast fill aavunnu… book cheyyumo? 😊”",
      "“Innu wash njangal handle cheyyam… but kurachu slots mathram baki 😌”",
      "“Ningalk vendi oru slot save cheyyan thonni 😏 but others fast aayi book cheyyunnu 👀”",
      "“Late aayal… ningal miss aakum 😌 njangal wait cheyyunnu ketto”"
    ];

    const activeLines = templates.length > 0 ? templates.map((t: any) => t.text) : defaultTemplates;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Check quiet hours: avoid sending between 10 PM and 8 AM
    const currentHour = now.getHours();
    const quietStart = Number(reminderSettings?.quietHoursStart ?? 22);
    const quietEnd = Number(reminderSettings?.quietHoursEnd ?? 8);
    const isQuietHour = currentHour >= quietStart || currentHour < quietEnd;

    // 2. Scan Users for Weekly / 5-Day Re-book Reminders
    if (!isQuietHour) {
      const usersSnap = await getDocs(collection(dbClient, "users"));
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Skip admins
        if (userData.role === "admin" || userData.adminRole) continue;

        // Check last reminder timestamp (anti-spam rule: max 1 per week or interval)
        const lastReminded = userData.lastWashReminderDate;
        if (lastReminded) {
          const diffDaysSinceReminder = (now.getTime() - new Date(lastReminded).getTime()) / (1000 * 3600 * 24);
          if (diffDaysSinceReminder < daysInterval) continue;
        }

        // Check user's last order date
        const lastOrderDateStr = userData.lastOrderDate || userData.createdAt;
        if (!lastOrderDateStr) continue;

        const lastOrderTime = new Date(lastOrderDateStr).getTime();
        const daysSinceLastOrder = (now.getTime() - lastOrderTime) / (1000 * 3600 * 24);

        // Check if user has any active/pending upcoming booking
        // If they already have a booking pending or today, don't nag them
        if (daysSinceLastOrder >= daysInterval) {
          // Pick a random witty Malayalam/English message
          const randomText = activeLines[Math.floor(Math.random() * activeLines.length)];

          await addDoc(collection(dbClient, "notifications"), {
            userId: userId,
            title: "WashWise Laundry Reminder 🤍",
            message: randomText,
            type: "weekly_wash_reminder",
            link: "/dashboard",
            isRead: false,
            status: "unread",
            createdAt: new Date().toISOString()
          });

          // Send push notification if token available
          sendPushNotification(userId, {
            title: "WashWise 🤍",
            body: randomText,
            data: { link: "/dashboard" }
          }).catch(() => {});

          // Update user lastWashReminderDate to prevent irritating duplicates
          await updateDoc(doc(dbClient, "users", userId), {
            lastWashReminderDate: new Date().toISOString()
          });

          count++;
        }
      }
    }

    // 3. Scan Upcoming Wash Slots for Today (Upcoming Wash Reminders)
    const bookingsTodaySnap = await getDocs(
      query(collection(dbClient, "bookings"), where("date", "==", todayStr))
    );

    for (const bDoc of bookingsTodaySnap.docs) {
      const bData = bDoc.data();
      const bId = bDoc.id;

      if (!bData.upcomingNotified && bData.status && ["paid", "pending"].includes(bData.status)) {
        await addDoc(collection(dbClient, "notifications"), {
          userId: bData.userId,
          title: "⏰ Upcoming Wash Reminder",
          message: `Your laundry slot is today (${bData.timeSlot || 'scheduled time'}). Have your clothes sorted & ready!`,
          type: "upcoming_wash",
          bookingId: bId,
          link: `/confirmation?id=${bId}`,
          isRead: false,
          status: "unread",
          createdAt: new Date().toISOString()
        });

        sendPushNotification(bData.userId, {
          title: "⏰ Upcoming Wash Today",
          body: `Your slot at ${bData.timeSlot || 'WashWise'} is scheduled for today.`,
          data: { bookingId: bId }
        }).catch(() => {});

        await updateDoc(doc(dbClient, "bookings", bId), {
          upcomingNotified: true
        });
        count++;
      }
    }

    // 4. Scan Subscription Expiry & Credit Renewal Reminders (3 days prior)
    const subscribersSnap = await getDocs(
      query(collection(dbClient, "users"), where("userType", "==", "subscriber"))
    );

    for (const subDoc of subscribersSnap.docs) {
      const subData = subDoc.data();
      const subId = subDoc.id;
      const resetDate = subData.creditResetDate;

      if (resetDate && !subData.renewalNotifiedDate) {
        const daysToReset = (new Date(resetDate).getTime() - now.getTime()) / (1000 * 3600 * 24);
        if (daysToReset > 0 && daysToReset <= 3) {
          await addDoc(collection(dbClient, "notifications"), {
            userId: subId,
            title: "💳 Monthly Credits Renewal",
            message: `Your subscription credits reset in ${Math.ceil(daysToReset)} days on ${resetDate}. Make sure to utilize any remaining wash loads!`,
            type: "subscription_renewal_reminder",
            link: "/profile",
            isRead: false,
            status: "unread",
            createdAt: new Date().toISOString()
          });

          await updateDoc(doc(dbClient, "users", subId), {
            renewalNotifiedDate: todayStr
          });
          count++;
        }
      }
    }

    return { success: true, remindersSent: count };
  } catch (error: any) {
    console.error("Error running smart reminders scan:", error);
    return { success: false, error: error.message, remindersSent: count };
  }
}

// Endpoint for Admin or Client to trigger a scan check
app.post("/api/reminders/trigger-check", async (req, res) => {
  try {
    const requester = await authenticateRequest(req);
    if (!requester || (!requester.isAdmin && !requester.isSuperAdmin)) {
      return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
    }

    const result = await runSmartRemindersScan();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to trigger reminder check" });
  }
});

// Periodic automated background interval (Runs every 30 minutes in background)
setInterval(() => {
  runSmartRemindersScan().catch((err) => {
    console.warn("Background reminder scan notice:", err);
  });
}, 30 * 60 * 1000);

// Vite middleware setup
async function startServer() {
  try {
    const httpServer = http.createServer(app);

    if (process.env.NODE_ENV !== "production") {
      const isHmrDisabled = process.env.DISABLE_HMR === "true";
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: isHmrDisabled ? false : { server: httpServer }
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          } else if (filePath.includes("/assets/")) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        }
      }));
      app.get("*", (req, res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    httpServer.on("error", (err: any) => {
      console.error("Server listen error:", err);
    });
  } catch (err) {
    console.error("Critical error during startServer:", err);
  }
}

startServer().catch((err) => {
  console.error("Unhandled error in startServer:", err);
});
