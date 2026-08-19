// lib/firebaseAdmin.js
import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      "chimney-solutions-nt";
    const clientEmail =
      process.env.FIREBASE_CLIENT_EMAIL ||
      "firebase-adminsdk-fbsvc@chimney-solutions-nt.iam.gserviceaccount.com";
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey) {
      privateKey = privateKey.trim();
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, "\n");
    }

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("✅ Firebase Admin initialized with full credentials");
    } else {
      console.warn("⚠️ Firebase Admin credentials incomplete in environment");
    }
  } catch (error) {
    console.error("🔥 Firebase Admin initialization error:", error.message || error);
  }
}

/**
 * Send High-Priority Instant Push Notification with Vibration & Lock Screen Alert
 */
export async function sendNotification(token, title, body, data = {}, url = "/tech/calls") {
  try {
    if (!token) {
      console.log("❌ No FCM token provided for notification");
      return false;
    }

    if (!admin.apps.length) {
      console.warn("⚠️ Firebase Admin not initialized, skipping notification send");
      return false;
    }

    const stringifiedData = {};
    if (data && typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        stringifiedData[key] = value !== null && value !== undefined ? String(value) : "";
      }
    }
    stringifiedData.url = url || "/tech/calls";
    stringifiedData.click_action = url || "/tech/calls";
    stringifiedData.timestamp = String(Date.now());

    const notificationTag =
      stringifiedData.tag ||
      (stringifiedData.forwardedCallId ? `lead_${stringifiedData.forwardedCallId}` : `cs_${Date.now()}`);

    const message = {
      token,
      notification: {
        title: String(title || "⚡ Chimney Solutions"),
        body: String(body || ""),
      },
      data: {
        ...stringifiedData,
        tag: notificationTag,
      },
      // 📱 Web Push (Chrome, iOS Safari PWA, Firefox, Edge) - Native Executive Look
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "86400",
        },
        notification: {
          title: String(title || "⚡ Chimney Solutions"),
          body: String(body || ""),
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          vibrate: [300, 100, 300],
          requireInteraction: false, // Disappears naturally like native apps
          silent: false,
          renotify: false, // Prevents duplicate spam popups
          tag: notificationTag,
          actions: [
            {
              action: "open_app",
              title: "📱 Open Lead",
            },
          ],
        },
        fcm_options: {
          link: url || "/tech/calls",
        },
      },
      // 🤖 Android System Level Lock-screen Notification
      android: {
        priority: "high",
        ttl: 86400 * 1000,
        notification: {
          title: String(title || "⚡ Chimney Solutions"),
          body: String(body || ""),
          sound: "default",
          channelId: "crm_leads_channel",
          icon: "/icons/icon-192x192.png",
          color: "#2563eb",
          tag: notificationTag,
          vibrateTimingsMillis: [300, 100, 300],
          priority: "high",
          visibility: "public",
          notificationCount: 1,
        },
      },
      // 🍏 Apple APNs Lock-screen Alert
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
        },
        payload: {
          aps: {
            alert: {
              title: String(title || "⚡ Chimney Solutions"),
              body: String(body || ""),
            },
            sound: "default",
            badge: 1,
            "thread-id": notificationTag,
            "content-available": 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log("⚡ Push Sent Successfully to device:", token.slice(-8));
    return response;
  } catch (err) {
    const errMsg = String(err?.message || err || "");
    const errCode = String(err?.code || "");

    // 🧹 Auto-purge stale or unregistered FCM tokens from database
    if (
      errCode === "messaging/registration-token-not-registered" ||
      errCode === "messaging/invalid-registration-token" ||
      errMsg.includes("NotRegistered") ||
      errMsg.includes("invalid-registration-token")
    ) {
      console.log("🧹 [FCM] Purging expired/unregistered device token from database:", token.slice(-10));
      import("./mongodb.js")
        .then((m) => m.default)
        .then(async (client) => {
          const db = client.db("mydatabase");
          await Promise.all([
            db.collection("fcm_tokens").deleteMany({ token }),
            db.collection("technicians").updateMany({}, { $pull: { fcmTokens: token } }),
          ]);
        })
        .catch(() => {});
      return false;
    }

    console.error("❌ FCM Push Error:", errMsg);
    return false;
  }
}

/**
 * Send high-priority instant notifications to multiple tokens concurrently
 */
export async function sendNotificationToTokens(tokens, title, body, data = {}, url = "/tech/calls") {
  if (!Array.isArray(tokens) || tokens.length === 0) return { success: 0, failure: 0 };

  const validTokens = Array.from(new Set(tokens.filter((t) => typeof t === "string" && t.trim().length > 0)));
  if (validTokens.length === 0) return { success: 0, failure: 0 };

  let successCount = 0;
  let failureCount = 0;

  await Promise.all(
    validTokens.map(async (token) => {
      const res = await sendNotification(token, title, body, data, url);
      if (res) successCount++;
      else failureCount++;
    })
  );

  return { success: successCount, failure: failureCount };
}

export default admin;
