// pages/_app.js
import Head from "next/head";
import "../styles/globals.css";
import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import NotificationPermissionBanner from "../components/NotificationPermissionBanner";

export default function MyApp({ Component, pageProps }) {
  const [token, setToken] = useState(null);
  const initedRef = useRef(false);

  const firebaseConfig = {
    apiKey: "AIzaSyCf6VNLkMzTOV51FFqWHrxB-KBr5Vu_xtM",
    authDomain: "chimney-solutions-nt.firebaseapp.com",
    projectId: "chimney-solutions-nt",
    storageBucket: "chimney-solutions-nt.appspot.com",
    messagingSenderId: "391952557503",
    appId: "1:391952557503:web:b2fefa69b6005c45dcad0a",
    measurementId: "G-2361S394R0",
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initedRef.current) return;
    initedRef.current = true;

    let cancelled = false;

    const registerAndInit = async () => {
      try {
        // 1. Register Service Worker with wide scope
        let swReg = null;
        if ("serviceWorker" in navigator) {
          try {
            swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
              scope: "/",
            });
            console.log("✅ Service Worker registered:", swReg.scope);
          } catch (err) {
            console.warn("❌ Service Worker registration failed:", err);
          }
        }

        // 2. Fetch logged in user identity
        let currentUser = null;
        try {
          const authRes = await fetch("/api/auth/me", { credentials: "same-origin" });
          if (authRes.ok) {
            currentUser = await authRes.json();
            if (currentUser?.id) {
              localStorage.setItem("userId", currentUser.id);
              localStorage.setItem("userRole", currentUser.role || "technician");
              if (currentUser.username) localStorage.setItem("username", currentUser.username);
            }
          }
        } catch (e) {}

        // 3. Dynamic Firebase Import
        const firebaseAppMod = await import("firebase/app");
        const firebaseMessagingMod = await import("firebase/messaging");

        const { initializeApp, getApps, getApp } = firebaseAppMod;
        const { getMessaging, getToken, onMessage, isSupported } = firebaseMessagingMod;

        const supported = await isSupported();
        if (!supported) {
          console.warn("⚠️ Firebase Messaging not supported in this browser");
          return;
        }

        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const messaging = getMessaging(app);

        // 4. Request System Notification Permission & Get Token
        if ("Notification" in window) {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            try {
              const currentToken = await getToken(messaging, {
                vapidKey:
                  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
                  "BNQGS7VCHzRbEZi5xMvzVFIlsGr6aFtkEtEbaK43x39Y8vLT-wexc738Y-AlycYmKBasGrxTcP6udOSymXUHZKg",
                serviceWorkerRegistration: swReg || undefined,
              });

              if (currentToken && !cancelled) {
                setToken(currentToken);
                localStorage.setItem("fcmToken", currentToken);
                console.log("📱 Device FCM Push Token Registered:", currentToken.slice(-10));

                const userId = currentUser?.id || currentUser?._id || localStorage.getItem("userId");
                const username = currentUser?.username || localStorage.getItem("username");
                const role = currentUser?.role || localStorage.getItem("userRole") || "technician";

                if (userId || username) {
                  await fetch("/api/save-fcm-token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      token: currentToken,
                      userId,
                      username,
                      role,
                    }),
                  }).catch(() => {});
                }
              }
            } catch (err) {
              console.warn("⚠️ getToken error:", err);
            }
          }
        }

        // 5. Foreground Notification Handling (In-App Toast Banner only, no duplicate OS spam)
        onMessage(messaging, (payload) => {
          if (cancelled) return;
          console.log("📩 Incoming Push Received:", payload);

          const title = payload?.notification?.title || payload?.data?.title || "⚡ Chimney Solutions";
          const body = payload?.notification?.body || payload?.data?.body || "";
          const targetUrl = payload?.data?.url || "/tech/calls";

          // 🔊 Audio feedback
          try {
            const audio = new Audio("/forward.mp3");
            audio.play().catch(() => {});
          } catch (e) {}

          // 📳 Phone vibration (native haptics)
          try {
            if (navigator.vibrate) {
              navigator.vibrate([500, 150, 500, 150, 500]);
            }
          } catch (e) {}

          // In-App Toast Banner
          toast.custom(
            (t) => (
              <div
                onClick={() => {
                  toast.dismiss(t.id);
                  if (targetUrl) window.location.href = targetUrl;
                }}
                className="cursor-pointer max-w-md w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-2xl rounded-2xl p-4 flex items-center gap-3 border border-white/25 transform transition-all hover:scale-[1.02] animate-bounce"
              >
                <div className="h-10 w-10 rounded-xl bg-white/20 grid place-items-center flex-shrink-0 text-xl shadow-inner">
                  🔔
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-sm tracking-tight truncate">{title}</div>
                  <div className="text-xs text-blue-100 line-clamp-2 mt-0.5">{body}</div>
                </div>
              </div>
            ),
            { duration: 7000, position: "top-right" }
          );
        });
      } catch (err) {
        console.error("🔥 registerAndInit error:", err);
      }
    };

    registerAndInit();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Head>
        {/* iOS Zoom prevention & responsive viewport */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Brand icons */}
        <link rel="icon" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </Head>

      <Toaster position="top-right" reverseOrder={false} />
      <NotificationPermissionBanner />
      <Component {...pageProps} />
    </>
  );
}
