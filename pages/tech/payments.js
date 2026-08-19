"use client";
export const dynamic = "force-dynamic";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

// 🔊 SUCCESS SOUND (forward.mp3)
const successSound = typeof window !== "undefined" ? new Audio("/forward.mp3") : null;
function playSuccessSound() {
  try {
    if (!successSound) return;
    successSound.currentTime = 0;
    successSound.play().catch(() => {});
  } catch {}
}

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

export default function Payments() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [deviceToken, setDeviceToken] = useState(null);

  // 🔹 Paying name + signature only
  const [form, setForm] = useState({
    receiver: "",
    receiverSignature: "",
  });

  const sigRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(500);
  const [sigEmpty, setSigEmpty] = useState(true);

  // 🔹 Call selection states (multi-call)
  const [calls, setCalls] = useState([]); // lifetime merged calls with paymentStatus
  const [callsLoading, setCallsLoading] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callSearch, setCallSearch] = useState("");

  // Modal sub-tab: "pending" or "paid"
  const [modalTab, setModalTab] = useState("pending");
  const [showAllInModal, setShowAllInModal] = useState(false);

  // 🟦 Technician-selected calls with per-call payments
  const [selectedCalls, setSelectedCalls] = useState([]);

  // 🎉 Happy success overlay
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // ✅ Responsive SignaturePad width
  useEffect(() => {
    const updateSize = () => {
      setCanvasWidth(window.innerWidth < 640 ? window.innerWidth - 40 : 500);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Patch SignaturePad to fix Chrome/Safari touchmove intervention warning
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
          if (e && e.cancelable) {
            e.preventDefault();
          }
          const touch = e?.targetTouches?.[0];
          if (touch && typeof pad._strokeMoveUpdate === "function") {
            pad._strokeMoveUpdate(touch);
          }
        };

        if (origTouchStart) {
          pad._handleTouchStart = function (e) {
            if (e && e.cancelable) {
              e.preventDefault();
            }
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
            if (e && e.cancelable) {
              e.preventDefault();
            }
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
    const controller = new AbortController();
    (async () => {
      try {
        const me = await fetch("/api/auth/me", { signal: controller.signal });
        if (!me.ok) {
          window.location.href = "/login";
          return;
        }
        const u = await me.json();
        if (u.role !== "technician") {
          window.location.href = "/login";
          return;
        }
        setUser(u);
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // ----------------------------
  // LOAD CALLS (LIFETIME + PAYMENT MERGE)
  // ----------------------------
  const loadCalls = useCallback(async () => {
    setCallsLoading(true);
    try {
      // 1) Fetch technician calls (we request big pageSize for lifetime)
      const params = new URLSearchParams({
        tab: "All Calls",
        page: "1",
        pageSize: "1000",
      });

      const r1 = await fetch("/api/tech/my-calls?" + params.toString(), {
        cache: "no-store",
      });
      const d1 = await r1.json();
      const apiCalls = Array.isArray(d1.items) ? d1.items : [];

      // 2) Fetch admin customer-payments authoritative list (has payment matches)
      const r2 = await fetch("/api/tech/payment-check", { cache: "no-store" }).catch(() => null);
      const d2 = r2 ? await r2.json().catch(() => null) : null;
      // payment-check returns { paidCallIds: [], paidKeys: [] }
      const paidCallIds = new Set(Array.isArray(d2?.paidCallIds) ? d2.paidCallIds.map(String) : []);
      const paidKeySet = new Set(Array.isArray(d2?.paidKeys) ? d2.paidKeys : []);

      // Map API calls and decide paymentStatus using (1) server claim (i.paymentStatus), (2) admin maps
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

        // if admin says paid by callId or normalized key, override to Paid
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
          price: i.price ?? 0,
          status: i.status ?? "Pending",
          createdAt: i.createdAt ?? "",
          createdAtTime: createdAt ? createdAt.getTime() : 0,
          paymentStatus,
        };
      });

      // Sort: pending first (not canceled), then by newest
      mapped.sort((a, b) => {
        const aPaid = a.paymentStatus === "Paid";
        const bPaid = b.paymentStatus === "Paid";
        if (aPaid !== bPaid) return aPaid ? 1 : -1; // Pending before Paid
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

  // Firebase (unchanged)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (typeof window === "undefined" || !"Notification" in window) return;

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
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "BNQGS7VCHzRbEZi5xMvzVFIlsGr6aFtkEtEbaK43x39Y8vLT-wexc738Y-AlycYmKBasGrxTcP6udOSymXUHZKg",
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
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
              📢 {payload?.notification?.title || "New Notification"}
              <br />
              {payload?.notification?.body || ""}
            </div>
          );
        });
      } catch (err) {
        console.error("🔥 Firebase Messaging Init Error:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ Clear signature
  const clearSig = useCallback(() => {
    try {
      sigRef.current?.clear();
    } catch {}
    setForm((prev) => ({ ...prev, receiverSignature: "" }));
    setSigEmpty(true);
  }, []);

  // ✅ Input handler
  const handleChange = useCallback((field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value })), []);

  // signature onEnd handler
  const handleSigEnd = useCallback(() => {
    try {
      const data = sigRef.current?.toDataURL() || "";
      setForm((prev) => ({ ...prev, receiverSignature: data }));
      const empty = sigRef.current?.isEmpty ? sigRef.current.isEmpty() : !data;
      setSigEmpty(Boolean(empty));
    } catch (err) {
      // ignore
    }
  }, []);

  // 🔹 Add call to selected list (multi-select)
  const addCallToSelected = useCallback((call) => {
    if (!call) return;
    // prevent adding already paid calls
    if (call.paymentStatus === "Paid") {
      toast.error("Call already paid — cannot select");
      return;
    }
    setSelectedCalls((prev) => {
      if (prev.some((c) => c._id === call._id)) return prev;
      return [
        ...prev,
        {
          ...call,
          onlineAmount: "",
          cashAmount: "",
        },
      ];
    });
    setCallModalOpen(false);
  }, []);

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

  // ----------------------------
  // filteredCalls for modal with tab & search & paging (show small set by default)
  // ----------------------------
  const filteredCallsForModal = useMemo(() => {
    const q = (callSearch || "").trim().toLowerCase();

    // Base: exclude canceled always
    let base = calls.filter((c) => String(c.status || "").toLowerCase() !== "canceled");

    if (modalTab === "paid") {
      // only show calls that are *closed* and *paid*
      base = base.filter((c) => c.paymentStatus === "Paid" && isClosedStatus(c.status));
    } else {
      // pending -> any non-paid calls
      base = base.filter((c) => c.paymentStatus !== "Paid");
    }

    // search
    if (q.length > 0) {
      base = base.filter(
        (c) =>
          (c.clientName || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.address || "").toLowerCase().includes(q)
      );
    }

    // sorting: newest first
    const sorted = [...base].sort((a, b) => b.createdAtTime - a.createdAtTime);

    // default limits (show small chunk unless showAll requested or search active)
    const isSearchActive = q.length > 0;
    if (isSearchActive) return sorted;

    const defaultLimit = modalTab === "paid" ? 5 : 6;
    if (showAllInModal) return sorted;
    return sorted.slice(0, defaultLimit);
  }, [calls, callSearch, modalTab, showAllInModal]);

  // ----------------------------
  // Submit payment (calls -> /api/tech/payment)
  // ----------------------------
  const submit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!selectedCalls.length) return toast.error("Please select at least one call");
      if (!form.receiver || !form.receiver.trim()) return toast.error("Please enter paying name");

      const receiverSignature = form.receiverSignature || (sigRef.current?.toDataURL ? sigRef.current.toDataURL() : "");
      // ensure signature present client-side
      const sigPresent = Boolean(receiverSignature) && !(sigRef.current && sigRef.current.isEmpty && sigRef.current.isEmpty());
      if (!sigPresent) return toast.error("Receiver signature required");

      // double-check none of the selected calls are already Paid (safety)
      const alreadyPaid = selectedCalls.filter((c) => c.paymentStatus === "Paid").map((c) => c._id);
      if (alreadyPaid.length) return toast.error("Some selected calls are already paid — remove them before submitting");

      let mode = "";
      if (totalOnline > 0 && totalCash > 0) mode = "Both";
      else if (totalOnline > 0) mode = "Online";
      else if (totalCash > 0) mode = "Cash";

      if (!mode) return toast.error("Please enter at least one amount (online/cash)");

      try {
        // dedupe selectedCalls by id (safety)
        const uniqueCalls = [];
        const seen = new Set();
        for (const c of selectedCalls) {
          if (!seen.has(c._id)) {
            seen.add(c._id);
            uniqueCalls.push(c);
          }
        }

        const payload = {
          receiver: form.receiver,
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

        const d = await r.json();
        if (!r.ok) {
          // backend will return helpful message if duplicate or other error
          return toast.error(d.message || d.error || "Failed to record payment");
        }

        // Optimistic local update for instant UX
        const paidCallIds = uniqueCalls.map((c) => c._id);
        setCalls((prev) => prev.map((c) => (paidCallIds.includes(c._id) ? { ...c, paymentStatus: "Paid" } : c)));

        // 🔊 SOUND
        playSuccessSound();

        // 🎉 Toast
        toast.success("✅ Payment recorded successfully");

        // 🔔 Optional notification (fire-and-forget)
        if (deviceToken) {
          fetch("/api/sendNotification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: deviceToken, title: "New Payment Recorded 💰", body: `${form.receiver} paid ₹${totalCombined} (${mode})` }),
          }).catch(() => {});
        }

        // 🎉 Happy overlay
        setShowSuccessOverlay(true);
        setTimeout(() => setShowSuccessOverlay(false), 1600);

        // Reset after success
        setForm({ receiver: "", receiverSignature: "" });
        setSelectedCalls([]);
        clearSig();

        // IMPORTANT: refresh canonical server state (merge again) but keep UI snappy
        await loadCalls();
      } catch (err) {
        console.error("Payment submission failed:", err);
        toast.error("Error recording payment");
      }
    },
    [selectedCalls, form.receiver, form.receiverSignature, totalOnline, totalCash, totalCombined, deviceToken, clearSig, loadCalls]
  );

  const canSubmit = useMemo(() => {
    const sigPresent = Boolean(form.receiverSignature) || (sigRef.current && sigRef.current.isEmpty ? !sigRef.current.isEmpty() : !sigEmpty);
    return selectedCalls.length > 0 && form.receiver && form.receiver.trim() && sigPresent && totalCombined > 0;
  }, [selectedCalls.length, form.receiver, form.receiverSignature, sigEmpty, totalCombined]);

  // ✅ Skeleton UI while loading
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
    <div className="min-h-screen bg-slate-50 safe-bottom">
      <Header user={user} />

      <main className="max-w-2xl mx-auto p-3 sm:p-6 space-y-4">
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white grid place-items-center text-xl shadow-md shadow-blue-500/20">
              💳
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Payment Collection</h1>
              <p className="text-xs text-slate-500">Record cash / online payments & receiver signature.</p>
            </div>
          </div>

          <form onSubmit={submit} className="grid gap-3">
            {/* 🔹 Select Call */}
            <div className="space-y-1">
              <div className="text-sm font-semibold text-gray-700">Select Call(s)</div>
              <button
                type="button"
                onClick={() => {
                  setCallSearch("");
                  setShowAllInModal(false);
                  setModalTab("pending");
                  setCallModalOpen(true);
                }}
                className="w-full border rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 flex justify-between items-center text-sm"
              >
                <span className="truncate">{selectedCalls.length ? `${selectedCalls.length} call(s) selected` : "Tap to select calls"}</span>
                <span className="text-gray-500 text-xs">View Calls ▾</span>
              </button>
            </div>

            {/* 🔹 Selected Calls List with Payment Inputs */}
            {selectedCalls.length > 0 ? (
              <div className="space-y-2">
                {selectedCalls.map((c) => {
                  const closed = isClosedStatus(c.status);
                  const badgeText = c.paymentStatus === "Paid" ? "Payment Done" : closed ? "PAYMENT PENDING" : "PENDING CASE";
                  const badgeClass = c.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : closed ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200";

                  return (
                    <div key={c._id} className="border rounded-xl p-3 bg-slate-50 flex flex-col gap-2">
                      <div className="flex justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate">
                              <div className="text-sm font-semibold truncate">{c.clientName || "Unknown"}</div>
                              <div className="text-xs text-gray-600">{c.phone || "-"}</div>
                            </div>

                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${badgeClass}`}>
                              {badgeText}
                            </span>
                          </div>

                          <div className="text-xs text-gray-500 line-clamp-1">{c.address || "-"}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{c.type || "Service"} • ₹{c.price}</div>
                        </div>
                        <div className="flex gap-2 items-start">
                          <button type="button" className="text-xs text-red-500 hover:text-red-600 flex-shrink-0" onClick={() => removeSelectedCall(c._id)}>✕ Remove</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="mb-1 text-gray-600">Online Amount (₹)</div>
                          <input type="number" className="w-full border rounded-lg px-2 py-1" value={c.onlineAmount} onChange={(e) => updateSelectedAmount(c._id, "onlineAmount", e.target.value)} min="0" />
                        </div>
                        <div>
                          <div className="mb-1 text-gray-600">Cash Amount (₹)</div>
                          <input type="number" className="w-full border rounded-lg px-2 py-1" value={c.cashAmount} onChange={(e) => updateSelectedAmount(c._id, "cashAmount", e.target.value)} min="0" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-500 border border-dashed rounded-xl p-3 bg-slate-50">No calls selected yet. Select at least one call to record payment.</div>
            )}

            {/* 🔹 Totals */}
            <div className="text-xs text-gray-700 bg-slate-50 border rounded-xl px-3 py-2 flex flex-wrap gap-2 justify-between">
              <span>Online: <span className="font-semibold">₹{totalOnline || 0}</span></span>
              <span>Cash: <span className="font-semibold">₹{totalCash || 0}</span></span>
              <span>Total: <span className="font-semibold">₹{totalCombined || 0}</span></span>
            </div>

            {/* 🔹 Paying Name */}
            <div>
              <div className="text-sm font-semibold mb-1">Paying Name</div>
              <input className="input w-full border rounded-lg px-3 py-2 focus:ring focus:ring-blue-200 text-sm" placeholder="Customer who paid" value={form.receiver} onChange={handleChange("receiver")} />
            </div>

            {/* 🔹 Signature */}
            <div>
              <div className="text-sm font-semibold mb-1">Receiver Signature</div>
              <div className="border rounded-xl overflow-hidden shadow-sm bg-white" style={{ touchAction: "none" }}>
                <SignaturePad ref={sigRef} onEnd={handleSigEnd} canvasProps={{ className: "sigCanvas bg-white w-full", width: canvasWidth, height: 200, style: { touchAction: "none" } }} />
              </div>
              <div className="text-xs text-gray-500 mt-1">Signature required. <button type="button" onClick={clearSig} className="underline">Clear</button></div>
            </div>

            {/* 🔹 Submit */}
            <button disabled={!canSubmit} className="bg-blue-600 text-white w-full rounded-lg py-2 font-medium hover:bg-blue-700 active:scale-95 transition disabled:opacity-60" type="submit">Submit Payment</button>
          </form>
        </div>
      </main>

      <BottomNav />

      {/* 🔵 CALL SELECT MODAL */}
      <AnimatePresence>
        {callModalOpen && (
          <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-4 max-h:[80vh] max-h-[80vh] flex flex-col" initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex gap-2 items-center">
                  <h2 className="font-semibold text-sm">Select Call</h2>
                  <div className="text-xs text-gray-500">({calls.length} total)</div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-slate-50 border px-2 py-1 text-xs flex gap-1">
                    <button onClick={() => { setModalTab("pending"); setShowAllInModal(false); }} className={`px-2 py-1 rounded-md ${modalTab === "pending" ? "bg-blue-600 text-white" : "text-slate-700"}`}>Pending</button>
                    <button onClick={() => { setModalTab("paid"); setShowAllInModal(false); }} className={`px-2 py-1 rounded-md ${modalTab === "paid" ? "bg-blue-600 text-white" : "text-slate-700"}`}>Paid</button>
                  </div>

                  <button onClick={() => setCallModalOpen(false)} className="text-gray-500 hover:text-black text-lg">✕</button>
                </div>
              </div>

              <input className="border rounded-lg px-3 py-2 mb-2 text-sm" placeholder="Search by name / phone / address" value={callSearch} onChange={(e) => { setCallSearch(e.target.value || ""); setShowAllInModal(true); }} />

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {callsLoading && <div className="text-center text-gray-500 py-4 text-sm">Loading calls...</div>}

                {!callsLoading && filteredCallsForModal.length === 0 && <div className="text-center text-gray-500 py-4 text-sm">No calls found.</div>}

                {!callsLoading && filteredCallsForModal.map((c) => {
                  const closed = isClosedStatus(c.status);
                  const badgeText = c.paymentStatus === "Paid" ? "Payment Done" : closed ? "PAYMENT PENDING" : "PENDING CASE";
                  const badgeClass = c.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : closed ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200";

                  // disable selecting already paid items
                  const disabled = c.paymentStatus === "Paid";

                  return (
                    <div key={c._id} className={`w-full border rounded-xl px-3 py-2 text-sm text-left transition ${disabled ? "opacity-60" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{c.clientName || "Unknown"}</div>
                          <div className="text-xs text-gray-600">{c.phone}</div>
                          <div className="text-xs text-gray-500 line-clamp-1">{c.address}</div>
                          <div className="text-[11px] text-gray-400">{c.type || "Service"} • ₹{c.price}</div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${badgeClass}`}>{badgeText}</span>

                          <div className="flex gap-2">
                            {!disabled && (
                              <button onClick={() => addCallToSelected(c)} className="bg-white border rounded px-2 py-1 text-xs">Select</button>
                            )}
                            {disabled && <button className="bg-gray-100 text-gray-600 rounded px-2 py-1 text-xs cursor-not-allowed">Already paid</button>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Show more / collapse */}
              <div className="mt-3 flex gap-2">
                {!showAllInModal && (<button onClick={() => setShowAllInModal(true)} className="flex-1 bg-white border rounded-xl py-2 text-sm">Show more</button>)}
                {showAllInModal && (<button onClick={() => { setShowAllInModal(false); setCallSearch(""); }} className="flex-1 bg-white border rounded-xl py-2 text-sm">Collapse</button>)}

                <button onClick={() => setCallModalOpen(false)} className="w-28 bg-gray-900 text-white py-2 rounded-xl text-sm">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎉 HAPPY SUCCESS OVERLAY */}
      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.7, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.7, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 180, damping: 15 }} className="relative bg-white rounded-3xl px-8 py-6 shadow-2xl text-center max-w-xs w-full overflow-hidden">
              <div className="pointer-events-none absolute -top-10 -left-10 h-24 w-24 bg-blue-100 rounded-full opacity-70" />
              <div className="pointer-events-none absolute -bottom-12 -right-6 h-28 w-28 bg-emerald-100 rounded-full opacity-70" />

              <div className="relative z-10 flex flex-col items-center gap-2">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 220, delay: 0.05 }} className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"><span className="text-white text-3xl">✔</span></motion.div>
                <div className="text-base font-semibold text-gray-900">Payment Saved Successfully</div>
                <div className="text-xs text-gray-600">All call payments recorded. Great job! ✨</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
