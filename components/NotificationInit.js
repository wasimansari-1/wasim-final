// components/NotificationInit.js
import { useEffect } from "react";
import toast from "react-hot-toast";

export default function NotificationInit({ userId, username, role = "technician" }) {
  useEffect(() => {
    if (typeof window === "undefined" || !"Notification" in window) return;

    let cancelled = false;

    (async () => {
      try {
        const { getMessaging, getToken, onMessage, isSupported } = await import("firebase/messaging");
        const { app } = await import("../lib/firebase");

        const supported = await isSupported();
        if (!supported) return;

        const messaging = getMessaging(app);
        const permission = await Notification.requestPermission();

        if (permission === "granted" && !cancelled) {
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "BNQGS7VCHzRbEZi5xMvzVFIlsGr6aFtkEtEbaK43x39Y8vLT-wexc738Y-AlycYmKBasGrxTcP6udOSymXUHZKg",
          });

          if (token && !cancelled) {
            const uid = userId || localStorage.getItem("userId");
            await fetch("/api/save-fcm-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token,
                userId: uid,
                username: username || localStorage.getItem("username"),
                role,
              }),
            });
          }
        }

        onMessage(messaging, (payload) => {
          if (cancelled) return;
          const title = payload?.notification?.title || payload?.data?.title || "Notification";
          const body = payload?.notification?.body || payload?.data?.body || "";
          toast.success(`${title}: ${body}`);
        });
      } catch (err) {
        console.warn("NotificationInit error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, username, role]);

  return null;
}
