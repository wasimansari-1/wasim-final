"use client";

import { useState, useEffect } from "react";
import { FiBell, FiCheck, FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

export default function NotificationPermissionBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [permission, setPermission] = useState("default");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    setPermission(Notification.permission);

    if (Notification.permission === "default") {
      // Prompt user to enable notification bar alerts
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const enableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return toast.error("Notifications not supported in this browser");
    }

    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        toast.success("Phone Notifications Enabled! 🔔✨");
        setShowBanner(false);

        // Trigger FCM Token Generation
        try {
          const { getMessaging, getToken } = await import("firebase/messaging");
          const { app } = await import("../lib/firebase");
          const messaging = getMessaging(app);

          const token = await getToken(messaging, {
            vapidKey:
              process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
              "BNQGS7VCHzRbEZi5xMvzVFIlsGr6aFtkEtEbaK43x39Y8vLT-wexc738Y-AlycYmKBasGrxTcP6udOSymXUHZKg",
          });

          if (token) {
            const userId = localStorage.getItem("userId");
            const username = localStorage.getItem("username");
            const role = localStorage.getItem("userRole") || "technician";

            await fetch("/api/save-fcm-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token,
                userId,
                username,
                role,
              }),
            });
            console.log("✅ FCM Token registered successfully:", token);
          }
        } catch (fcmErr) {
          console.warn("FCM registration error:", fcmErr);
        }
      } else if (result === "denied") {
        toast.error("Notification permission blocked in browser settings");
        setShowBanner(false);
      }
    } catch (err) {
      console.error("Permission request error:", err);
    } finally {
      setRequesting(false);
    }
  };

  if (!showBanner || permission === "granted") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed top-2 left-2 right-2 sm:left-auto sm:right-4 sm:max-w-md z-[200] bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-4 rounded-3xl shadow-2xl border border-white/30 backdrop-blur-xl"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-white/20 grid place-items-center text-xl shrink-0 shadow-inner animate-bounce">
            <FiBell />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-extrabold text-sm tracking-tight leading-tight">
              Enable Phone Notifications
            </h4>
            <p className="text-xs text-blue-100 mt-0.5 leading-snug">
              Receive instant call alerts in your phone&apos;s notification bar & lock screen even when app is closed.
            </p>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={enableNotifications}
                disabled={requesting}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-950 font-extrabold text-xs rounded-xl shadow transition"
              >
                {requesting ? "Enabling..." : "Enable Now 🔔"}
              </button>

              <button
                onClick={() => setShowBanner(false)}
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-xl transition"
              >
                Later
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowBanner(false)}
            className="text-white/70 hover:text-white p-1"
          >
            <FiX size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
