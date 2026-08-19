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

    const message = {
      token,
      notification: {
        title: String(title || "📞 New Notification"),
        body: String(body || ""),
      },
      data: stringifiedData,
      // 📱 Web Push (Chrome, iOS Safari PWA, Firefox, Edge)
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "86400", // Keep alive for 24h
        },
        notification: {
          title: String(title || "📞 New Notification"),
          body: String(body || ""),
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          vibrate: [500, 150, 500, 150, 500],
          requireInteraction: true,
          silent: false,
          renotify: true,
          tag: stringifiedData.forwardedCallId || `cs-call-${Date.now()}`,
          actions: [
            {
              action: "open_app",
              title: "📞 View Call",
            },
          ],
        },
        fcm_options: {
          link: url || "/tech/calls",
        },
      },
      // 🤖 Android System Level Lock-screen Wakeup & Sound
      android: {
        priority: "high",
        ttl: 86400 * 1000,
        notification: {
          title: String(title || "📞 New Notification"),
          body: String(body || ""),
          sound: "default",
          channelId: "urgent_call_channel",
          icon: "/icons/icon-192x192.png",
          color: "#1e40af",
          vibrateTimingsMillis: [500, 150, 500, 150, 500],
          priority: "max",
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
              title: String(title || "📞 New Notification"),
              body: String(body || ""),
            },
            sound: "default",
            badge: 1,
            "content-available": 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log("⚡ Instant Push Sent Successfully:", response);
    return response;
  } catch (err) {
    console.error("❌ FCM Push Error:", err.message || err);
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
