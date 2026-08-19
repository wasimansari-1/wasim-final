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

function showProfessionalNotification(payload) {
  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    "⚡ Chimney Solutions Lead";

  const body =
    payload?.notification?.body ||
    payload?.data?.body ||
    "New lead assigned to you. Open to view details.";

  const data = payload?.data || {};
  const targetUrl = data.url || "/tech/calls";
  const tag = data.tag || data.forwardedCallId ? `lead_${data.forwardedCallId}` : `cs_lead_${Date.now()}`;

  const notificationOptions = {
    body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: {
      ...data,
      url: targetUrl,
      time: Date.now(),
    },
    tag,
    renotify: false,
    requireInteraction: false,
    vibrate: [300, 100, 300],
    actions: [
      {
        action: "open_lead",
        title: "📱 Open Lead",
      },
    ],
  };

  return self.registration.showNotification(title, notificationOptions);
}

// ⚡ 1. FCM Background Handler
messaging.onBackgroundMessage((payload) => {
  console.log("⚡ [SW] FCM Background Message Received:", payload);
  return showProfessionalNotification(payload);
});

// ⚡ 2. Handle notification click & wake-up window
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
