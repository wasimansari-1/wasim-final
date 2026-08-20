"use client";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  FiTrash2,
  FiSearch,
  FiX,
  FiCheck,
  FiCreditCard,
  FiUser,
  FiMapPin,
  FiDollarSign,
} from "react-icons/fi";
import { FaMoneyBillWave, FaPhoneAlt } from "react-icons/fa";

// 🔊 SUCCESS SOUND
const successSound =
  typeof window !== "undefined" ? new Audio("/forward.mp3") : null;

function playSuccessSound() {
  try {
    if (!successSound) return;
    successSound.currentTime = 0;
    successSound.play().catch(() => {});
  } catch {}
}

const vibrate = (pattern = [30]) => {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {}
};

function getInitials(name) {
  if (!name) return "CS";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function isClosedStatus(status) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return s === "closed" || s === "completed" || s === "done";
}

export default function TechnicianPayments() {
  const [user, setUser] = useState(null);
  const [calls, setCalls] = useState([]);
  const [selectedCalls, setSelectedCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    receiver: "",
    receiverSignature: "",
  });

  // Signature Pad State & Dynamic Container Measurement
  const sigRef = useRef(null);
  const sigContainerRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(300);

  // Modal State
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callSearch, setCallSearch] = useState("");
  const [modalTab, setModalTab] = useState("all");

  // Happy success overlay
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [deviceToken, setDeviceToken] = useState("");

  // ResizeObserver for dynamic canvas sizing
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
      const fallback = typeof window !== "undefined" ? Math.min(window.innerWidth - 32, 480) : 300;
      setCanvasWidth(fallback > 0 ? fallback : 300);
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

  // Initial Load
  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) {
          window.location.href = "/login";
          return;
        }
        const u = await meRes.json();
        if (u.role !== "technician") {
          window.location.href = "/login";
          return;
        }
        setUser(u);
        await loadCalls();
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadCalls = useCallback(async () => {
    try {
      const res = await fetch("/api/tech/my-calls?tab=All%20Calls&pageSize=100", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && Array.isArray(data.items)) {
        setCalls(data.items);
      }
    } catch (e) {
      console.error("Load calls error:", e);
    }
  }, []);

  const clearSig = useCallback(() => {
    sigRef.current?.clear();
    setForm((prev) => ({ ...prev, receiverSignature: "" }));
  }, []);

  const openCallModal = useCallback(() => {
    setCallSearch("");
    setModalTab("all");
    setCallModalOpen(true);
  }, []);

  const toggleSelectCall = useCallback((call) => {
    if (!call || !call._id) return;
    vibrate([20]);

    setSelectedCalls((prev) => {
      const exists = prev.some((c) => c._id === call._id);
      if (exists) {
        return prev.filter((c) => c._id !== call._id);
      } else {
        const price = Number(call.price || 0);
        return [
          ...prev,
          {
            ...call,
            onlineAmount: String(price),
            cashAmount: "",
          },
        ];
      }
    });
  }, []);

  const removeSelectedCall = useCallback((callId) => {
    vibrate([15]);
    setSelectedCalls((prev) => prev.filter((c) => c._id !== callId));
  }, []);

  const updateSelectedAmount = useCallback((callId, field, val) => {
    setSelectedCalls((prev) =>
      prev.map((c) => {
        if (c._id !== callId) return c;
        return {
          ...c,
          [field]: val,
        };
      })
    );
  }, []);

  // Filtered Calls for Selection Modal
  const modalFilteredCalls = useMemo(() => {
    let list = calls.filter((c) => String(c.status || "").toLowerCase() !== "canceled");

    if (modalTab === "pending") {
      list = list.filter((c) => {
        const s = String(c.status || "").toLowerCase();
        return s === "pending" || s === "in process";
      });
    }

    if (!callSearch.trim()) return list;
    const q = callSearch.toLowerCase().trim();
    return list.filter(
      (c) =>
        (c.clientName || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.address || "").toLowerCase().includes(q) ||
        (c.type || "").toLowerCase().includes(q)
    );
  }, [calls, callSearch, modalTab]);

  // Aggregated Totals
  const { totalOnline, totalCash, totalCombined } = useMemo(() => {
    let online = 0;
    let cash = 0;

    selectedCalls.forEach((c) => {
      const on = Number(c.onlineAmount) || 0;
      const cs = Number(c.cashAmount) || 0;
      online += on;
      cash += cs;
    });

    return {
      totalOnline: online,
      totalCash: cash,
      totalCombined: online + cash,
    };
  }, [selectedCalls]);

  // Submit Handler
  const submit = useCallback(
    async (e) => {
      e.preventDefault();

      if (selectedCalls.length === 0) {
        toast.error("Please select at least 1 customer call");
        vibrate([80]);
        return;
      }

      if (!form.receiver.trim()) {
        toast.error("Please enter the paying customer / receiver name");
        vibrate([80]);
        return;
      }

      if (totalCombined <= 0) {
        toast.error("Total payment amount must be greater than ₹0");
        vibrate([80]);
        return;
      }

      let sigData = form.receiverSignature;
      try {
        if (sigRef.current && !sigRef.current.isEmpty()) {
          sigData = sigRef.current.toDataURL();
        }
      } catch {}

      try {
        setSubmitting(true);
        vibrate([30, 20, 30]);

        const mode =
          totalOnline > 0 && totalCash > 0
            ? "Split"
            : totalOnline > 0
            ? "Online"
            : "Cash";

        const uniqueCalls = Array.from(
          new Map(selectedCalls.map((c) => [c._id, c])).values()
        );

        const payload = {
          callId: uniqueCalls[0]?._id,
          amount: totalCombined,
          onlineAmount: totalOnline,
          cashAmount: totalCash,
          mode,
          receiver: form.receiver.trim(),
          receiverSignature: sigData || null,
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
    [selectedCalls, form.receiver, form.receiverSignature, totalOnline, totalCash, totalCombined, clearSig, loadCalls]
  );

  return (
    <div className="min-h-screen bg-slate-50 safe-bottom overflow-x-hidden w-full max-w-full">
      <Header user={user} />

      <main className="w-full max-w-2xl mx-auto px-2.5 sm:px-6 py-2.5 sm:py-6 space-y-3.5">
        <div className="w-full max-w-full bg-white rounded-3xl p-3 sm:p-6 shadow-sm border border-slate-200/80 space-y-4 overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center gap-2.5 sm:gap-3 pb-3 border-b border-slate-100 w-full">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-blue-600 text-white grid place-items-center text-lg sm:text-xl shadow-md shadow-blue-500/20 shrink-0">
              💳
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-lg font-black text-slate-900 leading-tight truncate">
                Payment Collection
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-snug mt-0.5">
                Record cash / online payments & receiver signature.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="grid gap-3.5 w-full">
            {/* Select Call Section */}
            <div className="space-y-1.5 w-full">
              <label className="text-xs sm:text-sm font-bold text-slate-700 block">
                Select Customer Call(s)
              </label>
              <button
                type="button"
                onClick={openCallModal}
                className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 sm:py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2 text-xs sm:text-sm transition active:scale-[0.99] cursor-pointer shadow-2xs overflow-hidden"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-base shrink-0">📋</span>
                  <span className="font-bold text-slate-800 truncate">
                    {selectedCalls.length
                      ? `✓ ${selectedCalls.length} call${selectedCalls.length > 1 ? "s" : ""} selected`
                      : "Tap to select customer calls"}
                  </span>
                </div>
                <span className="text-blue-600 font-bold text-[11px] sm:text-xs bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200 shrink-0 flex items-center gap-1">
                  <span>View Calls</span>
                  <span className="text-[9px]">▾</span>
                </span>
              </button>
            </div>

            {/* Selected Calls List with Quick Split Buttons */}
            {selectedCalls.length > 0 && (
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
                      className="w-full border border-slate-200/90 rounded-2xl p-2.5 sm:p-4 bg-slate-50/70 hover:bg-slate-50 flex flex-col gap-2.5 shadow-2xs transition overflow-hidden"
                    >
                      {/* Customer Info Header */}
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className="h-8 w-8 rounded-xl bg-slate-900 text-white font-black grid place-items-center text-xs shrink-0 shadow-xs">
                            {getInitials(c.clientName)}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs sm:text-sm text-slate-900 leading-snug truncate max-w-full">
                                {c.clientName || "Customer"}
                              </span>
                              <span
                                className={`text-[9px] sm:text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-full border whitespace-nowrap shrink-0 ${badgeClass}`}
                              >
                                {badgeText}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 font-semibold truncate flex items-center gap-1">
                              <FaPhoneAlt size={9} className="text-slate-400 shrink-0" />
                              <span className="truncate">{c.phone || "No phone"}</span>
                            </div>
                            <div className="text-[10px] sm:text-[10.5px] text-slate-500 line-clamp-1 flex items-center gap-1">
                              <FiMapPin size={9} className="text-slate-400 shrink-0" />
                              <span className="truncate">{c.address || "Address not provided"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Price & Remove Button */}
                        <div className="flex items-center gap-1.5 shrink-0 pl-1">
                          <div className="text-right">
                            <div className="text-[9px] text-slate-400 font-bold uppercase">Bill</div>
                            <div className="text-xs sm:text-sm font-black text-slate-900">
                              ₹{c.price || 0}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="h-7 w-7 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 grid place-items-center transition cursor-pointer shadow-2xs"
                            onClick={() => removeSelectedCall(c._id)}
                            title="Remove call"
                          >
                            <FiTrash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Quick Split Buttons - 3 Equal Responsive Columns */}
                      <div className="grid grid-cols-3 gap-1 sm:gap-1.5 w-full">
                        <button
                          type="button"
                          onClick={() => {
                            updateSelectedAmount(c._id, "onlineAmount", c.price);
                            updateSelectedAmount(c._id, "cashAmount", "");
                          }}
                          className={`min-w-0 flex items-center justify-center gap-1 py-1.5 px-1 rounded-xl border text-[10px] sm:text-xs font-black transition active:scale-95 cursor-pointer shadow-2xs ${
                            isFullOnline
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-white hover:bg-blue-50 text-blue-700 border-blue-200/80"
                          }`}
                        >
                          <FiCreditCard size={10} className="shrink-0" />
                          <span className="truncate">Full Online</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            updateSelectedAmount(c._id, "onlineAmount", "");
                            updateSelectedAmount(c._id, "cashAmount", c.price);
                          }}
                          className={`min-w-0 flex items-center justify-center gap-1 py-1.5 px-1 rounded-xl border text-[10px] sm:text-xs font-black transition active:scale-95 cursor-pointer shadow-2xs ${
                            isFullCash
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : "bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200/80"
                          }`}
                        >
                          <FaMoneyBillWave size={10} className="shrink-0" />
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
                          className={`min-w-0 flex items-center justify-center gap-1 py-1.5 px-1 rounded-xl border text-[10px] sm:text-xs font-black transition active:scale-95 cursor-pointer shadow-2xs ${
                            isSplit5050
                              ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                              : "bg-white hover:bg-purple-50 text-purple-700 border-purple-200/80"
                          }`}
                        >
                          <span>⚖️</span>
                          <span className="truncate">50/50 Split</span>
                        </button>
                      </div>

                      {/* Online vs Cash Amount Inputs */}
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <div className="space-y-1 min-w-0">
                          <label className="text-[10.5px] sm:text-xs font-bold text-slate-700 flex items-center gap-1 truncate">
                            <FiCreditCard size={11} className="text-blue-600 shrink-0" />
                            <span>Online (₹)</span>
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            value={c.onlineAmount || ""}
                            onChange={(e) =>
                              updateSelectedAmount(c._id, "onlineAmount", e.target.value)
                            }
                            className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 sm:py-2 bg-white text-slate-900 font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs sm:text-sm shadow-2xs"
                          />
                        </div>

                        <div className="space-y-1 min-w-0">
                          <label className="text-[10.5px] sm:text-xs font-bold text-slate-700 flex items-center gap-1 truncate">
                            <FaMoneyBillWave size={11} className="text-emerald-600 shrink-0" />
                            <span>Cash (₹)</span>
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            value={c.cashAmount || ""}
                            onChange={(e) =>
                              updateSelectedAmount(c._id, "cashAmount", e.target.value)
                            }
                            className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 sm:py-2 bg-white text-slate-900 font-extrabold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs sm:text-sm shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Entered vs Bill Match Indicator */}
                      <div className="flex items-center justify-between text-[10.5px] sm:text-xs pt-1 border-t border-slate-200/50">
                        <span className="text-slate-500">
                          Entered: <b className="text-slate-800">₹{callSum}</b> of ₹{callPrice}
                        </span>
                        {callPrice > 0 && callSum === callPrice ? (
                          <span className="text-emerald-700 font-extrabold flex items-center gap-0.5">
                            <FiCheck size={11} /> Matched
                          </span>
                        ) : callSum > callPrice ? (
                          <span className="text-rose-600 font-extrabold">
                            +₹{callSum - callPrice} Excess
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold">
                            ₹{callPrice - callSum} remaining
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Totals Summary */}
            {selectedCalls.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 rounded-2xl p-3 border border-blue-200/70 w-full space-y-1.5">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-white/80 rounded-xl p-2 border border-slate-200/60">
                    <div className="text-[10px] font-extrabold uppercase text-slate-500">Online</div>
                    <div className="text-sm sm:text-base font-black text-blue-600">₹{totalOnline}</div>
                  </div>
                  <div className="bg-white/80 rounded-xl p-2 border border-slate-200/60">
                    <div className="text-[10px] font-extrabold uppercase text-slate-500">Cash</div>
                    <div className="text-sm sm:text-base font-black text-emerald-600">₹{totalCash}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs font-bold pt-1 text-slate-800">
                  <span>Total Collected Amount:</span>
                  <span className="text-sm font-black text-indigo-700">₹{totalCombined}</span>
                </div>
              </div>
            )}

            {/* Receiver Name */}
            <div className="space-y-1 w-full pt-1 border-t border-slate-100">
              <label className="text-[11px] sm:text-xs font-bold text-slate-700 flex items-center gap-1">
                <FiUser size={11} className="text-blue-600" />
                <span>Paying Customer / Receiver Name *</span>
              </label>
              <input
                type="text"
                required
                placeholder="Name of customer who paid"
                value={form.receiver}
                onChange={(e) => setForm({ ...form, receiver: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs sm:text-sm shadow-2xs"
              />
            </div>

            {/* Signature Pad */}
            <div className="space-y-1.5 w-full pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[11px] sm:text-xs font-bold text-slate-700">
                  Receiver Signature (Sign inside box)
                </label>
                <button
                  type="button"
                  onClick={clearSig}
                  className="text-[11px] text-rose-500 hover:text-rose-700 font-bold hover:underline cursor-pointer"
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
                  canvasProps={{
                    width: canvasWidth,
                    height: 140,
                    className: "sigCanvas w-full max-w-full bg-white block",
                    style: {
                      width: "100%",
                      maxWidth: "100%",
                      height: "140px",
                      touchAction: "none",
                      display: "block",
                      boxSizing: "border-box",
                    },
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || selectedCalls.length === 0}
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold py-3 rounded-2xl text-xs sm:text-sm shadow-md shadow-blue-500/25 active:scale-[0.98] transition duration-150 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 mt-1"
            >
              {submitting ? (
                <>
                  <span className="inline-block border-2 w-4 h-4 rounded-full border-white border-t-transparent animate-spin" />
                  <span>Recording Payment...</span>
                </>
              ) : (
                <span className="truncate">
                  Save Payment {totalCombined > 0 ? `(₹${totalCombined})` : ""}
                </span>
              )}
            </button>
          </form>
        </div>
      </main>

      <BottomNav />

      {/* Select Calls Modal */}
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
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 mb-2 gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-extrabold text-base text-slate-900 truncate">
                    Select Calls for Payment
                  </h2>
                  <p className="text-xs text-slate-500 truncate">
                    Tap calls to add / remove from collection
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="rounded-xl bg-slate-100 p-0.5 text-xs flex gap-1">
                    <button
                      type="button"
                      onClick={() => setModalTab("all")}
                      className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                        modalTab === "all"
                          ? "bg-white text-blue-600 shadow-2xs"
                          : "text-slate-600"
                      }`}
                    >
                      All ({calls.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalTab("pending")}
                      className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                        modalTab === "pending"
                          ? "bg-white text-amber-600 shadow-2xs"
                          : "text-slate-600"
                      }`}
                    >
                      Pending
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

              <div className="relative mb-2 w-full">
                <input
                  className="w-full border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
                  placeholder="Search customer name, phone, address..."
                  value={callSearch}
                  onChange={(e) => setCallSearch(e.target.value || "")}
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

              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 py-1 min-h-0">
                {modalFilteredCalls.length === 0 && (
                  <div className="text-center text-slate-400 py-8 text-xs font-semibold space-y-1">
                    <div className="text-2xl">📋</div>
                    <div>No calls found.</div>
                  </div>
                )}

                {modalFilteredCalls.map((c) => {
                  const isSelected = selectedCalls.some((sc) => sc._id === c._id);
                  const isPaid = c.paymentStatus === "Paid";

                  return (
                    <div
                      key={c._id}
                      onClick={() => toggleSelectCall(c)}
                      className={`w-full rounded-2xl p-2.5 sm:p-3.5 border transition-all select-none flex items-start justify-between gap-2.5 cursor-pointer shadow-2xs ${
                        isSelected
                          ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20"
                          : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div
                          className={`h-8 w-8 rounded-xl font-extrabold grid place-items-center text-xs shrink-0 shadow-2xs ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-slate-900 text-white"
                          }`}
                        >
                          {isSelected ? "✓" : getInitials(c.clientName)}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight truncate max-w-full">
                              {c.clientName || "Customer"}
                            </span>
                            {isPaid && (
                              <span className="text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                                Paid
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

                      <div className="text-right shrink-0 space-y-1">
                        <div className="text-xs sm:text-sm font-black text-slate-900">
                          ₹{c.price || 0}
                        </div>
                        <span
                          className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap inline-block ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {isSelected ? "Selected" : "Select"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCallModalOpen(false)}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition cursor-pointer text-center"
                >
                  Done ({selectedCalls.length} selected)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Overlay */}
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
                  Payment Recorded
                </div>
                <div className="text-xs text-gray-600">
                  Collected ₹{totalCombined} recorded successfully! ✨
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
