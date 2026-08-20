"use client";
export const dynamic = "force-dynamic";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  FiCheck,
  FiX,
  FiMapPin,
  FiTrash2,
  FiCreditCard,
  FiSearch,
  FiUser,
  FiPercent,
  FiSliders,
} from "react-icons/fi";
import {
  FaPhoneAlt,
  FaMoneyBillWave,
  FaCheckCircle,
} from "react-icons/fa";

// 🔊 SUCCESS SOUND (forward.mp3)
const successSound = typeof window !== "undefined" ? new Audio("/forward.mp3") : null;
function playSuccessSound() {
  try {
    if (!successSound) return;
    successSound.currentTime = 0;
    successSound.play().catch(() => {});
  } catch {}
}

const vibrate = (pattern = [50, 30, 50]) => {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
};

function normalizeKey(clientName = "", phone = "", address = "") {
  return (
    String(clientName || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\w\d\s+,-]/g, "")
      .trim() +
    "|" +
    String(phone || "").toLowerCase().replace(/\s+/g, "").replace(/\D/g, "") +
    "|" +
    String(address || "").toLowerCase().replace(/\s+/g, " ").trim()
  );
}

function isClosedStatus(status) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return ["closed", "completed", "done", "resolved", "finished"].some((x) => s.includes(x));
}

function getInitials(name) {
  if (!name) return "CS";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Payments() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [deviceToken, setDeviceToken] = useState(null);

  // 🔹 Paying name + signature only
  const [form, setForm] = useState({
    receiver: "",
    receiverSignature: "",
  });

  const sigRef = useRef(null);
  const sigContainerRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(500);
  const [sigEmpty, setSigEmpty] = useState(true);

  // 🔹 Call selection states (multi-call)
  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callSearch, setCallSearch] = useState("");

  // Modal sub-tab: "pending" or "paid"
  const [modalTab, setModalTab] = useState("pending");
  const [showAllInModal, setShowAllInModal] = useState(false);

  // 🔲 Multi-selection IDs in modal
  const [modalSelectedIds, setModalSelectedIds] = useState(new Set());

  // 🟦 Confirmed selected calls with per-call payments
  const [selectedCalls, setSelectedCalls] = useState([]);

  // 🎉 Happy success overlay
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // ✅ Responsive SignaturePad width (measured from container ref to prevent any mobile horizontal overflow)
  useEffect(() => {
    const updateSize = () => {
      if (sigContainerRef.current) {
        const w =
          sigContainerRef.current.clientWidth ||
          sigContainerRef.current.getBoundingClientRect().width;
        if (w > 0) {
          setCanvasWidth(Math.floor(w));
          return;
        }
      }
      const fallback = typeof window !== "undefined" ? Math.min(window.innerWidth - 32, 500) : 320;
      setCanvasWidth(fallback > 0 ? fallback : 320);
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    let ro = null;
    if (typeof ResizeObserver !== "undefined" && sigContainerRef.current) {
      ro = new ResizeObserver(() => updateSize());
      ro.observe(sigContainerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateSize);
      if (ro) ro.disconnect();
    };
  }, [loading]);

  // Patch SignaturePad touch handling
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      const pad =
        sigRef.current?.getSignaturePad?.() ||
        sigRef.current?._sigPad ||
        sigRef.current;
      const canvas =
        sigRef.current?.getCanvas?.() ||
        pad?._canvas ||
        sigRef.current?._canvas;

      if (pad && pad._handleTouchMove) {
        const origTouchMove = pad._handleTouchMove;
        const origTouchStart = pad._handleTouchStart;
        const origTouchEnd = pad._handleTouchEnd;

        pad._handleTouchMove = function (e) {
          if (e && e.cancelable) e.preventDefault();
          const touch = e?.targetTouches?.[0];
          if (touch && typeof pad._strokeMoveUpdate === "function") {
            pad._strokeMoveUpdate(touch);
          }
        };

        if (origTouchStart) {
          pad._handleTouchStart = function (e) {
            if (e && e.cancelable) e.preventDefault();
            if (e?.targetTouches?.length === 1) {
              const touch = e.changedTouches[0];
              if (touch && typeof pad._strokeBegin === "function") {
                pad._strokeBegin(touch);
              }
            }
          };
        }

        if (origTouchEnd) {
          pad._handleTouchEnd = function (e) {
            if (e && e.cancelable) e.preventDefault();
            if (typeof pad._strokeEnd === "function") {
              pad._strokeEnd(e);
            }
          };
        }

        if (canvas) {
          canvas.style.touchAction = "none";
          try {
            canvas.removeEventListener("touchmove", origTouchMove);
            canvas.removeEventListener("touchstart", origTouchStart);
            canvas.removeEventListener("touchend", origTouchEnd);
            canvas.addEventListener("touchstart", pad._handleTouchStart, { passive: false });
            canvas.addEventListener("touchmove", pad._handleTouchMove, { passive: false });
            canvas.addEventListener("touchend", pad._handleTouchEnd, { passive: false });
          } catch {}
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [loading]);

  // ✅ Fetch user fast
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) {
          if (isMounted) window.location.href = "/login";
          return;
        }
        const u = await me.json();
        if (u.role !== "technician") {
          if (isMounted) window.location.href = "/login";
          return;
        }
        if (isMounted) setUser(u);
      } catch (err) {
        // silent
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // ----------------------------
  // LOAD CALLS (LIFETIME + PAYMENT MERGE)
  // ----------------------------
  const loadCalls = useCallback(async () => {
    setCallsLoading(true);
    try {
      const params = new URLSearchParams({
        tab: "All Calls",
        page: "1",
        pageSize: "1000",
      });

      const [r1, r2] = await Promise.all([
        fetch("/api/tech/my-calls?" + params.toString()).catch(() => null),
        fetch("/api/tech/payment-check").catch(() => null),
      ]);

      const d1 = r1 ? await r1.json().catch(() => ({ items: [] })) : { items: [] };
      const d2 = r2 ? await r2.json().catch(() => null) : null;

      const apiCalls = Array.isArray(d1.items) ? d1.items : [];
      const paidCallIds = new Set(Array.isArray(d2?.paidCallIds) ? d2.paidCallIds.map(String) : []);
      const paidKeySet = new Set(Array.isArray(d2?.paidKeys) ? d2.paidKeys : []);

      const mapped = apiCalls.map((i) => {
        const rawPaymentStatus =
          i.paymentStatus || i.payment_status || i.payment_state || i.paymentDone || i.isPaymentDone || "";
        let paymentStatus = "Pending";
        if (rawPaymentStatus === true) paymentStatus = "Paid";
        else if (rawPaymentStatus === false) paymentStatus = "Pending";
        else if (typeof rawPaymentStatus === "string") {
          const s = rawPaymentStatus.toLowerCase();
          if (s === "paid" || s === "payment done" || s === "done" || s === "completed") {
            paymentStatus = "Paid";
          }
        }

        const clientName = i.clientName ?? i.customerName ?? i.name ?? i.fullName ?? "";
        const phone = i.phone ?? "";
        const address = i.address ?? "";

        const callIdStr = String(i._id || i.id || "");
        const key = normalizeKey(clientName, phone, address);

        if (paidCallIds.has(callIdStr) || paidKeySet.has(key)) {
          paymentStatus = "Paid";
        }

        const createdAt = i.createdAt ? new Date(i.createdAt) : null;

        return {
          _id: callIdStr,
          clientName,
          phone,
          address,
          type: i.type ?? "",
          price: Number(i.price || 0),
          status: i.status ?? "Pending",
          createdAt: i.createdAt ?? "",
          createdAtTime: createdAt ? createdAt.getTime() : 0,
          paymentStatus,
        };
      });

      mapped.sort((a, b) => {
        const aPaid = a.paymentStatus === "Paid";
        const bPaid = b.paymentStatus === "Paid";
        if (aPaid !== bPaid) return aPaid ? 1 : -1;
        return b.createdAtTime - a.createdAtTime;
      });

      setCalls(mapped);
    } catch (err) {
      console.error("Calls load error:", err);
      toast.error("Failed to load calls");
    } finally {
      setCallsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadCalls();
  }, [user, loadCalls]);

  // Firebase
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (typeof window === "undefined" || !("Notification" in window)) return;

        const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
        const { initializeApp, getApps, getApp } = await import("firebase/app");

        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };

        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const messaging = getMessaging(app);

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const token = await getToken(messaging, {
          vapidKey:
            process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
            "BNQGS7VCHzRbEZi5xMvzVFIlsGr6aFtkEtEbaK43x39Y8vLT-wexc738Y-AlycYmKBasGrxTcP6udOSymXUHZKg",
        });

        if (mounted && token) {
          setDeviceToken(token);
          const uid = user?.id || user?._id || localStorage.getItem("userId");
          fetch("/api/save-fcm-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token,
              userId: uid,
              username: user?.username || localStorage.getItem("username"),
              role: "technician",
            }),
          }).catch(() => {});
        }

        onMessage(messaging, (payload) => {
          toast.custom(
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-bold">
              📢 {payload?.notification?.title || "New Notification"}
              <br />
              {payload?.notification?.body || ""}
            </div>
          );
        });
      } catch (err) {
        console.error("Firebase Messaging Init Error:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  // Clear signature
  const clearSig = useCallback(() => {
    try {
      sigRef.current?.clear();
    } catch {}
    setForm((prev) => ({ ...prev, receiverSignature: "" }));
    setSigEmpty(true);
  }, []);

  const handleChange = useCallback(
    (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value })),
    []
  );

  const handleSigEnd = useCallback(() => {
    try {
      const data = sigRef.current?.toDataURL() || "";
      setForm((prev) => ({ ...prev, receiverSignature: data }));
      const empty = sigRef.current?.isEmpty ? sigRef.current.isEmpty() : !data;
      setSigEmpty(Boolean(empty));
    } catch {}
  }, []);

  // -------------------------------------------------------------
  // MULTI-SELECTION MODAL HANDLERS
  // -------------------------------------------------------------
  const openCallModal = () => {
    setCallSearch("");
    setShowAllInModal(false);
    setModalTab("pending");
    setModalSelectedIds(new Set(selectedCalls.map((c) => c._id)));
    setCallModalOpen(true);
  };

  const toggleSelectCallInModal = (call) => {
    if (!call || call.paymentStatus === "Paid") return;
    setModalSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(call._id)) {
        next.delete(call._id);
      } else {
        next.add(call._id);
      }
      return next;
    });
    vibrate([10]);
  };

  const selectAllPendingInModal = () => {
    const pending = calls.filter(
      (c) => c.paymentStatus !== "Paid" && String(c.status || "").toLowerCase() !== "canceled"
    );
    setModalSelectedIds(new Set(pending.map((c) => c._id)));
    vibrate([20]);
  };

  const deselectAllInModal = () => {
    setModalSelectedIds(new Set());
    vibrate([10]);
  };

  const confirmModalSelection = () => {
    const existingMap = new Map(selectedCalls.map((c) => [c._id, c]));

    const newSelected = [];
    for (const call of calls) {
      if (modalSelectedIds.has(call._id)) {
        if (existingMap.has(call._id)) {
          newSelected.push(existingMap.get(call._id));
        } else {
          newSelected.push({
            ...call,
            onlineAmount: String(call.price || ""),
            cashAmount: "",
          });
        }
      }
    }

    setSelectedCalls(newSelected);
    setCallModalOpen(false);

    toast.success(`${newSelected.length} call(s) selected`);
  };

  const removeSelectedCall = useCallback((id) => {
    setSelectedCalls((prev) => prev.filter((c) => c._id !== id));
  }, []);

  const updateSelectedAmount = useCallback((id, field, value) => {
    const val = value === "" ? "" : String(value).replace(/[^\d.-]/g, "");
    setSelectedCalls((prev) => prev.map((c) => (c._id === id ? { ...c, [field]: val } : c)));
  }, []);

  // 🔢 Totals
  const { totalOnline, totalCash, totalCombined } = useMemo(() => {
    let online = 0;
    let cash = 0;
    for (const c of selectedCalls) {
      online += Number(c.onlineAmount || 0);
      cash += Number(c.cashAmount || 0);
    }
    return { totalOnline: online, totalCash: cash, totalCombined: online + cash };
  }, [selectedCalls]);

  // Filtered Calls for Modal
  const filteredCallsForModal = useMemo(() => {
    const q = (callSearch || "").trim().toLowerCase();

    let base = calls.filter((c) => String(c.status || "").toLowerCase() !== "canceled");

    if (modalTab === "paid") {
      base = base.filter((c) => c.paymentStatus === "Paid" && isClosedStatus(c.status));
    } else {
      base = base.filter((c) => c.paymentStatus !== "Paid");
    }

    if (q.length > 0) {
      base = base.filter(
        (c) =>
          (c.clientName || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.address || "").toLowerCase().includes(q)
      );
    }

    const sorted = [...base].sort((a, b) => b.createdAtTime - a.createdAtTime);

    if (q.length > 0 || showAllInModal) return sorted;
    const defaultLimit = modalTab === "paid" ? 5 : 8;
    return sorted.slice(0, defaultLimit);
  }, [calls, callSearch, modalTab, showAllInModal]);

  // Submit payment
  const submit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!selectedCalls.length) {
        toast.error("Please select at least one call first");
        vibrate([80]);
        return;
      }
      if (!form.receiver || !form.receiver.trim()) {
        toast.error("Please enter paying customer name");
        vibrate([80]);
        return;
      }

      // Dynamically extract signature directly from canvas
      let receiverSignature = form.receiverSignature;
      try {
        if (sigRef.current && !sigRef.current.isEmpty()) {
          receiverSignature = sigRef.current.toDataURL();
        }
      } catch {}

      if (!receiverSignature || (sigRef.current && sigRef.current.isEmpty && sigRef.current.isEmpty())) {
        toast.error("Please draw receiver signature in the box");
        vibrate([80]);
        return;
      }

      const alreadyPaid = selectedCalls.filter((c) => c.paymentStatus === "Paid").map((c) => c._id);
      if (alreadyPaid.length) {
        toast.error("Some selected calls are already paid — remove them before submitting");
        return;
      }

      let mode = "";
      if (totalOnline > 0 && totalCash > 0) mode = "Both";
      else if (totalOnline > 0) mode = "Online";
      else if (totalCash > 0) mode = "Cash";

      if (!mode || totalCombined <= 0) {
        toast.error("Please enter at least one amount (online or cash)");
        vibrate([80]);
        return;
      }

      try {
        setSubmitting(true);
        vibrate([40, 20, 40]);

        const uniqueCalls = [];
        const seen = new Set();
        for (const c of selectedCalls) {
          if (!seen.has(c._id)) {
            seen.add(c._id);
            uniqueCalls.push(c);
          }
        }

        const payload = {
          receiver: form.receiver.trim(),
          mode,
          onlineAmount: String(totalOnline),
          cashAmount: String(totalCash),
          receiverSignature,
          calls: uniqueCalls.map((c) => ({
            callId: c._id,
            clientName: c.clientName,
            phone: c.phone,
            address: c.address,
            type: c.type,
            price: c.price,
            onlineAmount: Number(c.onlineAmount || 0),
            cashAmount: Number(c.cashAmount || 0),
          })),
        };

        const r = await fetch("/api/tech/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          toast.error(d.message || d.error || "Failed to record payment");
          return;
        }

        const paidCallIds = uniqueCalls.map((c) => c._id);
        setCalls((prev) =>
          prev.map((c) => (paidCallIds.includes(c._id) ? { ...c, paymentStatus: "Paid" } : c))
        );

        playSuccessSound();
        toast.success("✅ Payment recorded successfully");

        if (deviceToken) {
          const techDisplayName = user?.name || user?.username || "Technician";
          fetch("/api/sendNotification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: deviceToken,
              title: `💰 ${techDisplayName} - Payment Recorded`,
              body: `${techDisplayName} recorded ₹${totalCombined} (${mode}) from ${form.receiver}`,
            }),
          }).catch(() => {});
        }

        setShowSuccessOverlay(true);
        setTimeout(() => setShowSuccessOverlay(false), 1600);

        setForm({ receiver: "", receiverSignature: "" });
        setSelectedCalls([]);
        clearSig();

        await loadCalls();
      } catch (err) {
        console.error("Payment submission failed:", err);
        toast.error("Error recording payment");
      } finally {
        setSubmitting(false);
      }
    },
    [
      selectedCalls,
      form.receiver,
      form.receiverSignature,
      totalOnline,
      totalCash,
      totalCombined,
      deviceToken,
      clearSig,
      loadCalls,
    ]
  );

  if (loading)
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
        <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div>
        <div className="h-6 bg-gray-200 rounded w-2/3 mx-auto"></div>
        <div className="h-40 bg-gray-200 rounded"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 safe-bottom overflow-x-hidden w-full">
      <Header user={user} />

      <main className="w-full max-w-2xl mx-auto px-3 sm:px-6 py-3 sm:py-6 space-y-4">
        <div className="w-full bg-white rounded-3xl p-3.5 sm:p-6 shadow-sm border border-slate-200/80 space-y-4 sm:space-y-5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white grid place-items-center text-xl shadow-md shadow-blue-500/20 shrink-0">
              💳
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">Payment Collection</h1>
              <p className="text-xs text-slate-500 truncate sm:whitespace-normal">Record cash / online payments & receiver signature.</p>
            </div>
          </div>

          <form onSubmit={submit} className="grid gap-3.5 w-full">
            {/* 🔹 Select Call */}
            <div className="space-y-1.5 w-full">
              <label className="text-xs sm:text-sm font-bold text-slate-700 block">
                Select Customer Call(s)
              </label>
              <button
                type="button"
                onClick={openCallModal}
                className="w-full border border-slate-200 rounded-2xl px-3.5 py-2.5 sm:py-3 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between gap-2 text-xs sm:text-sm transition active:scale-[0.99] cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">📋</span>
                  <span className="font-bold text-slate-800 truncate">
                    {selectedCalls.length
                      ? `✓ ${selectedCalls.length} call${selectedCalls.length > 1 ? "s" : ""} selected`
                      : "Tap to select calls"}
                  </span>
                </div>
                <span className="text-blue-600 font-bold text-xs bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-xl border border-blue-200 shrink-0 transition flex items-center gap-1">
                  <span>View Calls</span>
                  <span className="text-[10px]">▾</span>
                </span>
              </button>
            </div>

            {/* 🔹 Selected Calls List with Payment Inputs */}
            {selectedCalls.length > 0 ? (
              <div className="space-y-3 w-full">
                {selectedCalls.map((c) => {
                  const closed = isClosedStatus(c.status);
                  const badgeText =
                    c.paymentStatus === "Paid"
                      ? "Paid"
                      : closed
                      ? "Pending Payment"
                      : "Pending Case";
                  const badgeClass =
                    c.paymentStatus === "Paid"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : closed
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200";

                  const onlineNum = Number(c.onlineAmount || 0);
                  const cashNum = Number(c.cashAmount || 0);
                  const callSum = onlineNum + cashNum;
                  const callPrice = Number(c.price || 0);

                  const isFullOnline = callPrice > 0 && onlineNum === callPrice && cashNum === 0;
                  const isFullCash = callPrice > 0 && cashNum === callPrice && onlineNum === 0;
                  const isSplit5050 =
                    callPrice > 0 &&
                    onlineNum === Math.ceil(callPrice / 2) &&
                    cashNum === Math.floor(callPrice / 2);

                  return (
                    <div
                      key={c._id}
                      className="w-full border border-slate-200/90 rounded-2xl p-3 sm:p-4 bg-slate-50/60 hover:bg-slate-50 flex flex-col gap-3 shadow-2xs hover:border-slate-300 transition overflow-hidden"
                    >
                      {/* Customer Info Header */}
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white font-black grid place-items-center text-xs shrink-0 shadow-xs">
                            {getInitials(c.clientName)}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs sm:text-sm text-slate-900 leading-snug truncate max-w-full">
                                {c.clientName || "Customer"}
                              </span>
                              <span
                                className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${badgeClass}`}
                              >
                                {badgeText}
                              </span>
                            </div>
                            <div className="text-[11px] sm:text-xs text-slate-600 font-semibold truncate flex items-center gap-1">
                              <FaPhoneAlt size={9} className="text-slate-400 shrink-0" />
                              <span className="truncate">{c.phone || "No phone"}</span>
                            </div>
                            <div className="text-[10.5px] sm:text-[11px] text-slate-500 line-clamp-1 flex items-center gap-1">
                              <FiMapPin size={10} className="text-slate-400 shrink-0" />
                              <span className="truncate">{c.address || "Address not provided"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Price & Remove Button */}
                        <div className="flex items-center gap-1.5 shrink-0 pl-1">
                          <div className="text-right">
                            <div className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">Bill</div>
                            <div className="text-xs sm:text-sm font-black text-slate-900">
                              ₹{c.price || 0}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-white hover:bg-rose-50 border border-slate-200/80 hover:border-rose-200 text-slate-400 hover:text-rose-600 grid place-items-center transition cursor-pointer shadow-2xs"
                            onClick={() => removeSelectedCall(c._id)}
                            title="Remove call"
                          >
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Quick Split Buttons - 3 Equal Responsive Columns */}
                      <div className="grid grid-cols-3 gap-1.5 w-full">
                        <button
                          type="button"
                          onClick={() => {
                            updateSelectedAmount(c._id, "onlineAmount", c.price);
                            updateSelectedAmount(c._id, "cashAmount", "");
                          }}
                          className={`min-w-0 flex items-center justify-center gap-1 py-1.5 sm:py-2 px-1 rounded-xl border text-[10.5px] sm:text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs ${
                            isFullOnline
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-white hover:bg-blue-50 text-blue-700 border-blue-200/80 hover:border-blue-300"
                          }`}
                        >
                          <FiCreditCard size={11} className="shrink-0" />
                          <span className="truncate">Full Online</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            updateSelectedAmount(c._id, "onlineAmount", "");
                            updateSelectedAmount(c._id, "cashAmount", c.price);
                          }}
                          className={`min-w-0 flex items-center justify-center gap-1 py-1.5 sm:py-2 px-1 rounded-xl border text-[10.5px] sm:text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs ${
                            isFullCash
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : "bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:border-emerald-300"
                          }`}
                        >
                          <FaMoneyBillWave size={11} className="shrink-0" />
                          <span className="truncate">Full Cash</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const price = Math.round(Number(c.price || 0));
                            const online = Math.ceil(price / 2);
                            const cash = Math.floor(price / 2);
                            updateSelectedAmount(c._id, "onlineAmount", String(online));
                            updateSelectedAmount(c._id, "cashAmount", String(cash));
                          }}
                          className={`min-w-0 flex items-center justify-center gap-1 py-1.5 sm:py-2 px-1 rounded-xl border text-[10.5px] sm:text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs ${
                            isSplit5050
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                              : "bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200/80 hover:border-indigo-300"
                          }`}
                        >
                          <FiPercent size={11} className="shrink-0" />
                          <span className="truncate">50/50 Split</span>
                        </button>
                      </div>

                      {/* Online & Cash Amount Inputs */}
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <div className="min-w-0">
                          <label className="mb-1 text-slate-600 font-bold flex items-center gap-1 text-[11px] sm:text-xs truncate">
                            <FiCreditCard size={11} className="text-blue-600 shrink-0" />
                            <span className="truncate">Online (₹)</span>
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck="false"
                            className="w-full border border-slate-200/90 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs text-sm sm:text-sm transition"
                            value={c.onlineAmount}
                            onChange={(e) =>
                              updateSelectedAmount(c._id, "onlineAmount", e.target.value)
                            }
                            min="0"
                            placeholder="0"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="mb-1 text-slate-600 font-bold flex items-center gap-1 text-[11px] sm:text-xs truncate">
                            <FaMoneyBillWave size={11} className="text-emerald-600 shrink-0" />
                            <span className="truncate">Cash (₹)</span>
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck="false"
                            className="w-full border border-slate-200/90 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs text-sm sm:text-sm transition"
                            value={c.cashAmount}
                            onChange={(e) =>
                              updateSelectedAmount(c._id, "cashAmount", e.target.value)
                            }
                            min="0"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {/* Card Total Match Status */}
                      <div className="text-[11px] sm:text-xs font-semibold text-slate-500 flex items-center justify-between gap-1.5 flex-wrap pt-1.5 border-t border-slate-200/60 w-full">
                        <span className="truncate">
                          Entered: <b className="text-slate-900 font-extrabold">₹{callSum}</b> of ₹{c.price || 0}
                        </span>
                        {callSum === callPrice && callPrice > 0 ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1 shrink-0 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                            <FiCheck size={11} /> Matched
                          </span>
                        ) : callSum > callPrice ? (
                          <span className="text-amber-600 font-bold shrink-0 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                            +₹{callSum - callPrice} Extra
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium shrink-0">
                            ₹{callPrice - callSum} Remaining
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50/60 text-center space-y-1 w-full">
                <div className="text-xl">📋</div>
                <div className="font-bold text-slate-700">No calls selected yet</div>
                <p className="text-[11px] text-slate-400">
                  Click &quot;View Calls ▾&quot; above to check single or multiple customer calls.
                </p>
              </div>
            )}

            {/* 🔹 Totals Summary */}
            <div className="w-full grid grid-cols-3 gap-2 p-3 sm:p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl text-center shadow-2xs">
              <div className="min-w-0">
                <div className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider truncate">Online</div>
                <div className="font-extrabold text-blue-600 text-xs sm:text-sm truncate">₹{totalOnline || 0}</div>
              </div>
              <div className="min-w-0 border-x border-slate-200/80 px-1">
                <div className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider truncate">Cash</div>
                <div className="font-extrabold text-emerald-600 text-xs sm:text-sm truncate">₹{totalCash || 0}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider truncate">Total</div>
                <div className="font-black text-slate-900 text-xs sm:text-sm truncate">₹{totalCombined || 0}</div>
              </div>
            </div>

            {/* 🔹 Paying Name */}
            <div className="w-full space-y-1">
              <label className="text-xs sm:text-sm font-bold text-slate-800 block">Paying Customer Name</label>
              <input
                type="text"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck="false"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm shadow-2xs transition"
                placeholder="Customer who paid"
                value={form.receiver}
                onChange={handleChange("receiver")}
                required
              />
            </div>

            {/* 🔹 Signature */}
            <div className="w-full space-y-1">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800">
                <span>Receiver Signature</span>
                <button
                  type="button"
                  onClick={clearSig}
                  className="text-xs text-rose-500 hover:text-rose-700 hover:underline font-semibold cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div
                ref={sigContainerRef}
                className="w-full max-w-full border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white"
                style={{ touchAction: "none" }}
              >
                <SignaturePad
                  ref={sigRef}
                  onBegin={() => setSigEmpty(false)}
                  onEnd={handleSigEnd}
                  canvasProps={{
                    className: "sigCanvas bg-white block w-full",
                    width: canvasWidth,
                    height: 160,
                    style: {
                      width: "100%",
                      maxWidth: "100%",
                      height: "160px",
                      touchAction: "none",
                      display: "block",
                    },
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Please ask customer to draw signature above.
              </p>
            </div>

            {/* 🔹 Submit */}
            <button
              disabled={submitting}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl py-3 sm:py-3.5 font-bold active:scale-[0.98] transition disabled:opacity-60 text-xs sm:text-sm shadow-md shadow-blue-500/25 mt-1 cursor-pointer flex items-center justify-center gap-2"
              type="submit"
            >
              {submitting ? (
                <>
                  <span className="inline-block border-2 w-4 h-4 rounded-full border-white border-t-transparent animate-spin" />
                  <span>Submitting Payment...</span>
                </>
              ) : (
                <span>
                  Submit Payment {selectedCalls.length > 0 ? `(${selectedCalls.length} Calls • ₹${totalCombined})` : ""}
                </span>
              )}
            </button>
          </form>
        </div>
      </main>

      <BottomNav />

      {/* 🔵 MULTI-SELECT CALL MODAL */}
      <AnimatePresence>
        {callModalOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4"
            onClick={() => setCallModalOpen(false)}
          >
            <motion.div
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-3.5 sm:p-4 max-h-[88vh] flex flex-col overflow-hidden"
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Header */}
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 mb-2 gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-extrabold text-base text-slate-900 truncate">Select Calls</h2>
                  <div className="text-xs text-gray-500 truncate">
                    {modalSelectedIds.size} selected of {calls.length} calls
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="rounded-xl bg-slate-100 p-0.5 text-xs flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setModalTab("pending");
                        setShowAllInModal(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        modalTab === "pending"
                          ? "bg-white text-blue-600 shadow-2xs"
                          : "text-slate-600"
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalTab("paid");
                        setShowAllInModal(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        modalTab === "paid"
                          ? "bg-white text-emerald-600 shadow-2xs"
                          : "text-slate-600"
                      }`}
                    >
                      Paid
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCallModalOpen(false)}
                    className="text-gray-400 hover:text-black text-xl p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Multi-select shortcuts bar */}
              {modalTab === "pending" && (
                <div className="flex items-center justify-between gap-2 pb-2 px-0.5 text-xs">
                  <div className="text-slate-500 font-medium truncate">
                    Tap to check calls:
                  </div>
                  <div className="flex items-center gap-2 font-bold shrink-0">
                    <button
                      type="button"
                      onClick={selectAllPendingInModal}
                      className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md border border-blue-200 transition active:scale-95 cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllInModal}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md border border-slate-200 transition active:scale-95 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="relative mb-2 w-full">
                <input
                  className="w-full border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
                  placeholder="Search customer, phone, address..."
                  value={callSearch}
                  onChange={(e) => {
                    setCallSearch(e.target.value || "");
                    setShowAllInModal(true);
                  }}
                />
                {callSearch && (
                  <button
                    type="button"
                    onClick={() => setCallSearch("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                  >
                    <FiX size={13} />
                  </button>
                )}
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 py-1 min-h-0">
                {callsLoading && (
                  <div className="space-y-2 py-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="skeleton-shimmer h-16 rounded-2xl border border-slate-100" />
                    ))}
                  </div>
                )}

                {!callsLoading && filteredCallsForModal.length === 0 && (
                  <div className="text-center text-slate-400 py-8 text-xs font-semibold space-y-1">
                    <div className="text-2xl">📋</div>
                    <div>No calls found in this tab.</div>
                  </div>
                )}

                {!callsLoading &&
                  filteredCallsForModal.map((c) => {
                    const closed = isClosedStatus(c.status);
                    const badgeText =
                      c.paymentStatus === "Paid"
                        ? "Paid"
                        : closed
                        ? "Pending Payment"
                        : "Pending Case";
                    const badgeClass =
                      c.paymentStatus === "Paid"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : closed
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200";

                    const isPaid = c.paymentStatus === "Paid";
                    const isChecked = modalSelectedIds.has(c._id);

                    return (
                      <div
                        key={c._id}
                        onClick={() => !isPaid && toggleSelectCallInModal(c)}
                        className={`w-full rounded-2xl p-2.5 sm:p-3.5 border transition-all select-none flex items-start justify-between gap-2.5 ${
                          isPaid
                            ? "opacity-60 bg-slate-50/70 border-slate-200 cursor-not-allowed"
                            : isChecked
                            ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-sm cursor-pointer"
                            : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 cursor-pointer shadow-2xs"
                        }`}
                      >
                        {/* Custom Checkbox Box & Customer Info */}
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          {/* Prominent Custom Checkbox */}
                          <div className="pt-0.5 shrink-0">
                            {isPaid ? (
                              <div className="h-5 w-5 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-700 grid place-items-center text-xs font-bold shadow-2xs">
                                ✓
                              </div>
                            ) : isChecked ? (
                              <div className="h-5 w-5 rounded-lg bg-blue-600 border-2 border-blue-600 text-white grid place-items-center text-xs font-black shadow-sm">
                                <FiCheck size={13} />
                              </div>
                            ) : (
                              <div className="h-5 w-5 rounded-lg border-2 border-slate-300 bg-white grid place-items-center transition shadow-2xs" />
                            )}
                          </div>

                          {/* Customer Details with Sharp Font */}
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight truncate max-w-full">
                                {c.clientName || "Customer"}
                              </span>
                              {c.type && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100 truncate max-w-[120px]">
                                  {c.type}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 font-semibold truncate flex items-center gap-1">
                              <FaPhoneAlt size={9} className="text-slate-400 shrink-0" />
                              <span className="truncate">{c.phone || "No phone"}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 line-clamp-1 flex items-center gap-1">
                              <FiMapPin size={10} className="text-slate-400 shrink-0" />
                              <span className="truncate">{c.address || "No address"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Price & Status Badge */}
                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-xs sm:text-sm font-black text-slate-900">
                            ₹{c.price || 0}
                          </div>
                          <span
                            className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap inline-block ${badgeClass}`}
                          >
                            {badgeText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Show more */}
              {!showAllInModal && !callSearch && (
                <button
                  type="button"
                  onClick={() => setShowAllInModal(true)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 rounded-xl text-xs font-semibold my-1 cursor-pointer"
                >
                  Show all calls
                </button>
              )}

              {/* Bottom confirmation action buttons */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCallModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer text-center"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmModalSelection}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition active:scale-95 cursor-pointer text-center truncate"
                >
                  Confirm Selected ({modalSelectedIds.size})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🎉 HAPPY SUCCESS OVERLAY */}
      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 180, damping: 15 }}
              className="relative bg-white rounded-3xl px-8 py-6 shadow-2xl text-center max-w-xs w-full overflow-hidden"
            >
              <div className="relative z-10 flex flex-col items-center gap-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, delay: 0.05 }}
                  className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg text-white text-3xl"
                >
                  ✓
                </motion.div>
                <div className="text-base font-semibold text-gray-900">
                  Payment Saved Successfully
                </div>
                <div className="text-xs text-gray-600">
                  All call payments recorded. Great job! ✨
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
