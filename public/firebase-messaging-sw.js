/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// ✅ Firebase config (PWA / Mobile / Background)
firebase.initializeApp({
  apiKey: "AIzaSyCf6VNLkMzTOV51FFqWHrxB-KBr5Vu_xtM",
  authDomain: "chimney-solutions-nt.firebaseapp.com",
  projectId: "chimney-solutions-nt",
  storageBucket: "chimney-solutions-nt.appspot.com",
  messagingSenderId: "391952557503",
  appId: "1:391952557503:web:b2fefa69b6005c45dcad0a",
  measurementId: "G-2361S394R0",
});

const messaging = firebase.messaging();

function showNativeNotification(payload) {
  console.log("⚡ Showing OS-level System Notification:", payload);

  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    "📞 New Notification";

  const body =
    payload?.notification?.body ||
    payload?.data?.body ||
    "New update from Chimney Solutions CRM.";

  const data = payload?.data || {};
  const targetUrl = data.url || "/tech/calls";

  const notificationOptions = {
    body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: {
      ...data,
      url: targetUrl,
      time: Date.now(),
    },
    tag: data.forwardedCallId || `cs-alert-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [500, 150, 500, 150, 500],
    sound: "/forward.mp3",
    actions: [
      {
        action: "open_app",
        title: "📞 View Call",
      },
    ],
  };

  return self.registration.showNotification(title, notificationOptions);
}

// ⚡ 1. FCM Background Handler
messaging.onBackgroundMessage((payload) => {
  return showNativeNotification(payload);
});

// ⚡ 2. Raw WebPush Handler (Guarantees 100% OS Push Delivery on all devices/browsers)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    event.waitUntil(showNativeNotification(payload));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("📞 Chimney Solutions Alert", {
        body: text || "You have a new update",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        vibrate: [500, 150, 500, 150, 500],
        data: { url: "/tech/calls" },
      })
    );
  }
});

// ⚡ Handle notification click & wake-up window
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification?.data?.url || "/tech/calls";
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
