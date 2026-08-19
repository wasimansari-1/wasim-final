"use client";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  memo,
  forwardRef,
} from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPhoneAlt,
  FaWhatsapp,
  FaDirections,
  FaEye,
  FaCheck,
  FaTimes,
  FaClock,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaUser,
  FaFileAlt,
  FaSyncAlt,
  FaTag,
  FaSearch,
} from "react-icons/fa";
import { FiX, FiChevronDown } from "react-icons/fi";
import { collection, query as fsQuery, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";

const TABS = [
  { id: "All Calls", label: "All", icon: FaPhoneAlt },
  { id: "Pending", label: "Pending", icon: FaClock },
  { id: "Closed", label: "Closed", icon: FaCheck },
  { id: "Canceled", label: "Canceled", icon: FaTimes },
];

const PAGE_SIZE = 60;

// Audio & Haptics
const playSound = () => {
  try {
    const audio = new Audio("/forward.mp3");
    audio.play().catch(() => {});
  } catch {}
};

const vibrate = (pattern = [50, 30, 50]) => {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
};

function formatFullDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

export default function TechCalls() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("Pending");
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [detailModalCall, setDetailModalCall] = useState(null);

  // User Auth
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          window.location.href = "/login";
          return;
        }
        const me = await res.json();
        if (me.role !== "technician") {
          window.location.href = "/login";
          return;
        }
        setUser(me);
        if (me.id) {
          localStorage.setItem("userId", me.id);
          localStorage.setItem("username", me.username || "");
        }
      } catch {
        window.location.href = "/login";
      }
    })();
  }, []);

  // Fetch Calls
  const fetchCalls = useCallback(
    async (showNotify = false) => {
      if (!user) return;
      try {
        setRefreshing(true);
        const params = new URLSearchParams({
          tab: "All Calls",
          page: "1",
          pageSize: String(PAGE_SIZE),
        });

        const res = await fetch(`/api/tech/my-calls?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (data.success && Array.isArray(data.items)) {
          setCalls(data.items);
        }

        if (showNotify) {
          toast.success("Calls Refreshed");
          vibrate([30]);
        }
      } catch (err) {
        console.error("fetch calls error:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchCalls();
    }
  }, [user, fetchCalls]);

  // Real-time Firestore sync
  useEffect(() => {
    if (!user?.username || !db) return;

    try {
      const q = fsQuery(
        collection(db, "notifications"),
        where("to", "==", user.username),
        orderBy("createdAt", "desc"),
        limit(5)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const notifTime = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : Date.now();

            if (Date.now() - notifTime < 30000) {
              playSound();
              vibrate([150, 80, 150]);
              toast.custom(
                (t) => (
                  <div
                    onClick={() => {
                      toast.dismiss(t.id);
                      fetchCalls();
                    }}
                    className="cursor-pointer max-w-md w-full bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3"
                  >
                    <div className="h-9 w-9 bg-blue-600 rounded-xl grid place-items-center text-base shrink-0">
                      🔔
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-white truncate">
                        {data.title || "New Call Assigned!"}
                      </div>
                      <div className="text-[11px] text-slate-300 line-clamp-1">{data.message}</div>
                    </div>
                  </div>
                ),
                { duration: 5000 }
              );
              fetchCalls();
            }
          }
        });
      });

      return () => unsub();
    } catch (e) {
      console.warn("Firestore listener error:", e);
    }
  }, [user?.username, fetchCalls]);

  // Status Updater (Optimistic)
  const updateStatus = async (callId, newStatus) => {
    if (!callId || !newStatus) return;

    const prevCalls = [...calls];
    const nowIso = new Date().toISOString();

    setCalls((prev) =>
      prev.map((c) =>
        c._id === callId
          ? {
              ...c,
              status: newStatus,
              closedAt: newStatus === "Closed" ? nowIso : c.closedAt,
              closedByName: newStatus === "Closed" ? (user?.username || c.techName) : c.closedByName,
            }
          : c
      )
    );

    setUpdatingId(callId);
    playSound();
    vibrate([40, 20, 60]);

    try {
      const res = await fetch("/api/tech/update-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: callId, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to update status");
      }

      toast.success(
        newStatus === "Closed"
          ? "Call Marked as Closed ✓"
          : newStatus === "Canceled"
          ? "Call Canceled"
          : "Call Marked as Pending"
      );
    } catch (err) {
      toast.error(err.message || "Update failed");
      setCalls(prevCalls);
    } finally {
      setUpdatingId(null);
    }
  };

  // Grouped calls
  const pendingCalls = useMemo(() => {
    return calls.filter((c) => c.status === "Pending" || c.status === "In Process");
  }, [calls]);

  const closedCalls = useMemo(() => {
    return calls.filter((c) => c.status === "Closed" || c.status === "Completed");
  }, [calls]);

  const canceledCalls = useMemo(() => {
    return calls.filter((c) => c.status === "Canceled" || c.status === "Cancelled");
  }, [calls]);

  const filterByQuery = (list) => {
    if (!query.trim()) return list;
    const q = query.toLowerCase().trim();
    return list.filter(
      (c) =>
        (c.clientName || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.address || "").toLowerCase().includes(q) ||
        (c.type || "").toLowerCase().includes(q)
    );
  };

  const visibleCalls = useMemo(() => {
    let list = calls;
    if (tab === "Pending") list = pendingCalls;
    else if (tab === "Closed") list = closedCalls;
    else if (tab === "Canceled") list = canceledCalls;

    return filterByQuery(list);
  }, [calls, tab, pendingCalls, closedCalls, canceledCalls, query]);

  return (
    <div className="min-h-screen bg-[#f8fafc] safe-bottom font-sans antialiased text-slate-800 select-none">
      <Header user={user} />

      <main className="max-w-lg mx-auto px-3.5 py-2.5 space-y-2.5">
        {/* Compact, Ultra-Sleek Top Bar (Takes minimal space above fold) */}
        <div className="bg-white rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-sm border border-slate-200/80 flex items-center justify-between gap-2">
          {/* User info */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-slate-900 text-white font-bold grid place-items-center text-xs shrink-0 shadow-sm overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                (user?.username || "T")[0].toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] sm:text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                <span>{user?.username || "Technician"}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium">{calls.length} Calls Total</div>
            </div>
          </div>

          {/* Quick Counter Pills & Refresh */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setTab("Pending")}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl text-[10px] sm:text-xs font-bold transition flex items-center gap-1 ${
                tab === "Pending"
                  ? "bg-amber-100 text-amber-900 ring-1 ring-amber-400"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>{pendingCalls.length}</span>
              <span className="text-[9px] text-slate-500 font-medium hidden sm:inline">Pending</span>
            </button>

            <button
              onClick={() => setTab("Closed")}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl text-[10px] sm:text-xs font-bold transition flex items-center gap-1 ${
                tab === "Closed"
                  ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-400"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{closedCalls.length}</span>
              <span className="text-[9px] text-slate-500 font-medium hidden sm:inline">Done</span>
            </button>

            <button
              onClick={() => fetchCalls(true)}
              disabled={refreshing}
              className="h-6 w-6 sm:h-7 sm:w-7 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 grid place-items-center transition shrink-0"
              title="Refresh"
            >
              <motion.div
                animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: 0.8, repeat: refreshing ? Infinity : 0 }}
              >
                <FaSyncAlt size={10} />
              </motion.div>
            </button>
          </div>
        </div>

        {/* Full-Width Professional Search Field */}
        <div className="relative w-full">
          <FaSearch className="absolute left-3.5 top-3 text-slate-400 text-xs" />
          <input
            className="w-full bg-white border border-slate-200/90 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 shadow-2xs transition"
            placeholder="Search customer, mobile number, address..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 p-0.5"
            >
              <FiX size={14} />
            </button>
          )}
        </div>

        {/* Smooth Horizontal Scrolling Tab Bar (Fits 3+ Tabs with Full Text & Blue Fade Active) */}
        <div className="w-full overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 min-w-max px-0.5">
            {TABS.map((t) => {
              const isActive = tab === t.id;
              const Icon = t.icon;
              const count =
                t.id === "Pending"
                  ? pendingCalls.length
                  : t.id === "Closed"
                  ? closedCalls.length
                  : t.id === "Canceled"
                  ? canceledCalls.length
                  : calls.length;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    vibrate([10]);
                  }}
                  className={`py-1.5 px-3 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all duration-150 flex items-center gap-1.5 select-none shrink-0 whitespace-nowrap ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 text-white shadow-md shadow-blue-500/25 border border-blue-500/40"
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <Icon
                    size={9.5}
                    className={`shrink-0 ${isActive ? "text-blue-100" : "text-slate-400"}`}
                  />
                  <span className="whitespace-nowrap tracking-tight">{t.label}</span>
                  {count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-extrabold shrink-0 ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Calls Feed (Zero-Lag Instant 0ms Rendering) */}
        {loading ? (
          <div className="space-y-2.5 pt-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-36 rounded-2xl" />
            ))}
          </div>
        ) : visibleCalls.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/70 space-y-2 shadow-2xs">
            <div className="h-10 w-10 bg-slate-50 text-slate-400 rounded-2xl grid place-items-center text-lg mx-auto">
              📋
            </div>
            <h3 className="font-bold text-slate-800 text-xs">No Calls in {tab}</h3>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              There are no customer records matching this filter.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 pt-0.5">
            {visibleCalls.map((call) => (
              <PixelPerfectCallCard
                key={call._id}
                call={call}
                onShowDetails={() => setDetailModalCall(call)}
                onUpdateStatus={updateStatus}
                isUpdating={updatingId === call._id}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      {/* 🌟 ULTRA-FAST VIEW ALL DETAILS BOTTOM SHEET MODAL */}
      <AnimatePresence>
        {detailModalCall && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setDetailModalCall(null)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 420, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-3.5 max-h-[88vh] overflow-y-auto"
            >
              {/* iOS Mobile sheet pull indicator */}
              <div className="h-1 w-10 bg-slate-200 rounded-full mx-auto sm:hidden" />

              {/* Modal Header */}
              <div className="flex justify-between items-start pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white font-bold grid place-items-center text-base shrink-0">
                    {(detailModalCall.clientName || "C")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-base leading-tight break-words">
                      {detailModalCall.clientName || "Customer Details"}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                        {detailModalCall.type || "Service Job"}
                      </span>
                      {detailModalCall.chooseLabel && (
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {detailModalCall.chooseLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setDetailModalCall(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 text-base shrink-0"
                >
                  <FiX />
                </button>
              </div>

              {/* Complete Backend Details Breakdown */}
              <div className="space-y-2 text-xs text-slate-700">
                {/* 1. Client Mobile Box */}
                <div className="p-3 bg-slate-50 rounded-2xl space-y-1 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <FaPhoneAlt size={9} /> Customer Mobile Number
                  </div>
                  <div className="font-bold text-slate-900 text-sm flex items-center justify-between gap-2 flex-wrap">
                    <span className="break-all">{detailModalCall.phone}</span>
                    <a
                      href={`tel:${detailModalCall.phone}`}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                    >
                      <FaPhoneAlt size={9} /> Call Direct
                    </a>
                  </div>
                </div>

                {/* 2. Full Service Address */}
                <div className="p-3 bg-slate-50 rounded-2xl space-y-1 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <FaMapMarkerAlt size={9} /> Full Address
                  </div>
                  <div className="font-medium text-slate-800 leading-relaxed break-words">
                    {detailModalCall.address || "Address not provided"}
                  </div>
                  {detailModalCall.address && (
                    <button
                      onClick={() => {
                        const encoded = encodeURIComponent(detailModalCall.address);
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, "_blank");
                      }}
                      className="mt-0.5 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <FaDirections size={10} /> Open in Google Maps ↗
                    </button>
                  )}
                </div>

                {/* 3. Service & Price */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-2xl space-y-0.5 border border-slate-100">
                    <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <FaTag size={9} /> Service Type
                    </div>
                    <div className="font-bold text-slate-900 break-words">{detailModalCall.type || "Service"}</div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-2xl space-y-0.5 border border-slate-100">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Price</div>
                    <div className="font-extrabold text-slate-900 text-sm">₹{detailModalCall.price || 0}</div>
                  </div>
                </div>

                {/* 4. Slot & Technician */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-2xl space-y-0.5 border border-slate-100">
                    <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <FaClock size={9} /> Slot / Timing
                    </div>
                    <div className="font-semibold text-slate-800 break-words">
                      {detailModalCall.timeZone || "Standard"}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-2xl space-y-0.5 border border-slate-100">
                    <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <FaUser size={9} /> Technician
                    </div>
                    <div className="font-semibold text-blue-700 break-words">
                      {detailModalCall.techName || "Assigned"}
                    </div>
                  </div>
                </div>

                {/* 5. Special Notes */}
                {detailModalCall.notes && (
                  <div className="p-2.5 bg-amber-50 rounded-2xl border border-amber-200/70 space-y-0.5">
                    <div className="text-[10px] uppercase font-bold text-amber-800 flex items-center gap-1">
                      <FaFileAlt size={9} /> Notes / Instructions
                    </div>
                    <p className="text-amber-950 font-medium leading-relaxed break-words">
                      {detailModalCall.notes}
                    </p>
                  </div>
                )}

                {/* 6. Assignment & Closure Audit */}
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <FaCalendarAlt size={9} /> Call Timeline
                  </div>
                  <div className="space-y-0.5 text-slate-600 font-medium">
                    <div className="flex justify-between items-center">
                      <span>Assigned:</span>
                      <b className="text-slate-800">{formatFullDate(detailModalCall.createdAt)}</b>
                    </div>
                    {detailModalCall.closedAt && (
                      <div className="flex justify-between items-center text-emerald-800 font-bold pt-0.5 border-t border-slate-200/80">
                        <span>Closed:</span>
                        <span>{formatFullDate(detailModalCall.closedAt)}</span>
                      </div>
                    )}
                    {detailModalCall.closedByName && (
                      <div className="flex justify-between items-center text-emerald-800 font-bold">
                        <span>Closed By:</span>
                        <span>{detailModalCall.closedByName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 7. Payment Status */}
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Payment Status</div>
                    <div className="font-bold text-slate-900">
                      {detailModalCall.paymentStatus === "Paid" ? "Payment Collected" : "Pending Payment"}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      detailModalCall.paymentStatus === "Paid"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {detailModalCall.paymentStatus || "Pending"}
                  </span>
                </div>
              </div>

              {/* Close Modal Button */}
              <button
                onClick={() => setDetailModalCall(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs transition shadow-sm"
              >
                Close Details
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------------
// 🎴 PIXEL-PERFECT CARD COMPONENT (EYE-FRIENDLY & ROCK-SOLID)
// -------------------------------------------------------------
const PixelPerfectCallCard = memo(function PixelPerfectCallCard({
  call,
  onShowDetails,
  onUpdateStatus,
  isUpdating,
}) {
  const isClosed = call.status === "Closed" || call.status === "Completed";
  const isCanceled = call.status === "Canceled" || call.status === "Cancelled";
  const isPending = !isClosed && !isCanceled;

  const cleanPhone = (call.phone || "").replace(/[^0-9]/g, "");

  const handleNavigate = (e) => {
    e.stopPropagation();
    if (!call.address) return toast.error("No address available");
    const encoded = encodeURIComponent(call.address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, "_blank");
  };

  const handleWhatsApp = (e) => {
    e.stopPropagation();
    if (!cleanPhone) return toast.error("No phone number");
    const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `Hello ${call.clientName || "Customer"}, I am your Chimney Solutions technician regarding your service visit.`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const chooseRaw = (call.chooseLabel || call.chooseCall || "").toString().toUpperCase();

  return (
    <div
      className={`rounded-2xl p-3 border space-y-2 transition-colors relative ${
        isClosed
          ? "bg-gradient-to-b from-emerald-50/30 via-white to-white border-emerald-200/70 shadow-2xs"
          : isCanceled
          ? "bg-gradient-to-b from-slate-100/40 via-white to-white border-slate-200/70 opacity-80 shadow-2xs"
          : "bg-gradient-to-b from-rose-50/30 via-white to-white border-rose-200/70 shadow-2xs"
      }`}
    >
      {/* 1. Header Bar: Brand + Status Pill + Price */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Status Indicator with Dynamic Animations */}
          {isPending && (
            <span className="relative px-2 py-0.5 rounded-full bg-gradient-to-r from-rose-100 to-pink-100 text-rose-900 border border-rose-200/90 text-[9px] font-extrabold flex items-center gap-1 shadow-2xs">
              <span className="relative flex h-2 w-2 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-600" />
              </span>
              <span className="tracking-tight">Pending Call</span>
            </span>
          )}

          {isClosed && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 text-[9px] font-extrabold flex items-center gap-1">
              <FaCheck size={7} className="text-emerald-700" />
              Closed
            </span>
          )}

          {isCanceled && (
            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300 text-[9px] font-bold">
              ✕ Canceled
            </span>
          )}

          {/* Brand Source */}
          {chooseRaw && (
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[8.5px] font-bold uppercase tracking-wider">
              {chooseRaw.replace(/_/g, " ")}
            </span>
          )}
        </div>

        <div className="text-right shrink-0">
          <span className="text-xs font-black text-slate-900 bg-slate-100/90 px-2 py-0.5 rounded-md">
            ₹{call.price || 0}
          </span>
        </div>
      </div>

      {/* 2. Customer Body */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight break-words tracking-tight">
            {call.clientName || "Customer"}
          </h3>
          {call.type && (
            <span className="text-[9.5px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded shrink-0">
              {call.type}
            </span>
          )}
        </div>

        {/* Contact & Address */}
        <div className="space-y-0.5 pt-0.5 text-[10.5px]">
          <div className="font-semibold text-slate-800 flex items-center gap-1.5 break-all">
            <FaPhoneAlt size={8} className="text-slate-400 shrink-0" />
            <span>{call.phone}</span>
          </div>

          <div className="text-slate-600 flex items-start gap-1.5 leading-snug break-words">
            <FaMapMarkerAlt size={8.5} className="text-slate-400 shrink-0 mt-0.5" />
            <span>{call.address || "Address not specified"}</span>
          </div>
        </div>

        {/* Notes */}
        {call.notes && (
          <div className="p-1.5 rounded-lg bg-amber-50/80 border border-amber-200/50 text-[10px] text-amber-950 font-medium leading-snug break-words">
            <b className="font-bold">Note:</b> {call.notes}
          </div>
        )}

        {/* Time Stamp */}
        <div className="text-[9px] text-slate-400 flex items-center gap-1 pt-0.5 font-medium">
          <FaClock size={8} />
          <span>Assigned {timeAgo(call.createdAt)}</span>
          {call.timeZone && <span>• Slot: {call.timeZone}</span>}
        </div>

        {/* Closure Audit Tag if Closed */}
        {isClosed && call.closedAt && (
          <div className="p-1 rounded-lg bg-emerald-100/50 text-emerald-900 text-[9px] font-bold flex items-center gap-1 border border-emerald-200/60">
            <FaCheck size={7.5} className="text-emerald-700" />
            <span>Closed on {formatFullDate(call.closedAt)}</span>
          </div>
        )}
      </div>

      {/* 3. Action Buttons Grid (Call, Maps, WhatsApp, Details) */}
      <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-100">
        {/* 📞 Direct Call */}
        <a
          href={`tel:${cleanPhone}`}
          className="flex items-center justify-center gap-1 py-1 px-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-[10.5px] font-semibold rounded-lg border border-slate-200 shadow-2xs transition text-center"
          title="Direct Phone Call"
        >
          <FaPhoneAlt size={8.5} className="text-emerald-600 shrink-0" />
          <span>Call</span>
        </a>

        {/* 🗺️ Google Maps */}
        <button
          type="button"
          onClick={handleNavigate}
          className="flex items-center justify-center gap-1 py-1 px-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-[10.5px] font-semibold rounded-lg border border-slate-200 shadow-2xs transition text-center"
          title="Open Location in Google Maps"
        >
          <FaDirections size={9.5} className="text-blue-600 shrink-0" />
          <span>Map</span>
        </button>

        {/* 💬 WhatsApp */}
        <button
          type="button"
          onClick={handleWhatsApp}
          className="flex items-center justify-center gap-1 py-1 px-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-[10.5px] font-semibold rounded-lg border border-slate-200 shadow-2xs transition text-center"
          title="Open WhatsApp Chat"
        >
          <FaWhatsapp size={9.5} className="text-[#25D366] shrink-0" />
          <span>Chat</span>
        </button>

        {/* 👁️ View All Details */}
        <button
          type="button"
          onClick={onShowDetails}
          className="flex items-center justify-center gap-1 py-1 px-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-[10.5px] font-semibold rounded-lg border border-slate-200 shadow-2xs transition text-center"
          title="View Full Call Details"
        >
          <FaEye size={9} className="text-slate-500 shrink-0" />
          <span>Details</span>
        </button>
      </div>

      {/* 4. Status Selector & Quick Action Strip (Compact & Responsive) */}
      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
        {/* Status Dropdown Selector with Option Chevron Icon */}
        <div className="flex items-center gap-1 shrink-0 min-w-0">
          <span className="text-[8.5px] sm:text-[9px] font-bold text-slate-400 tracking-wider uppercase shrink-0">STATUS:</span>
          <div className="relative inline-flex items-center shrink-0">
            <select
              value={isClosed ? "Closed" : isCanceled ? "Canceled" : "Pending"}
              disabled={isUpdating}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "Canceled" && !confirm("Are you sure you want to cancel this call?")) return;
                onUpdateStatus(call._id, val);
              }}
              className={`appearance-none text-[9.5px] sm:text-[10px] font-bold py-0.5 pl-2 pr-5 rounded-md border transition-all cursor-pointer focus:outline-none shadow-2xs whitespace-nowrap ${
                isClosed
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70"
                  : isCanceled
                  ? "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200/70"
                  : "bg-gradient-to-r from-rose-50 via-pink-50 to-rose-100/80 text-rose-900 border-rose-300/90 hover:from-rose-100 hover:to-pink-100 shadow-2xs shadow-rose-500/10"
              }`}
            >
              <option value="Pending">● Pending</option>
              <option value="Closed">✓ Closed</option>
              <option value="Canceled">✕ Canceled</option>
            </select>
            <FiChevronDown
              size={9.5}
              className={`absolute right-1 pointer-events-none ${
                isClosed ? "text-emerald-700" : isCanceled ? "text-slate-500" : "text-rose-700"
              }`}
            />
          </div>
        </div>

        {/* Quick 1-Tap Action Button (Compact with Smooth Pulse & Shine Animation) */}
        <div className="shrink-0">
          {!isClosed ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onUpdateStatus(call._id, "Closed")}
              className="relative overflow-hidden group py-0.5 px-2 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-[9.5px] sm:text-[10px] font-bold rounded-md shadow-2xs shadow-emerald-600/30 transition-all duration-200 flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              {/* Subtle Shine Animation */}
              <span className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />

              {isUpdating ? (
                <>
                  <FaSyncAlt size={7.5} className="animate-spin text-white shrink-0" />
                  <span className="shrink-0">Closing...</span>
                </>
              ) : (
                <>
                  <span className="h-1 w-1 rounded-full bg-white animate-pulse shrink-0" />
                  <FaCheck size={7} className="text-white shrink-0" />
                  <span className="shrink-0">Close Call</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onUpdateStatus(call._id, "Pending")}
              className="py-0.5 px-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[9px] sm:text-[9.5px] font-bold rounded-md border border-slate-200 transition-all whitespace-nowrap shrink-0 flex items-center gap-1"
            >
              {isUpdating ? (
                <FaSyncAlt size={7} className="animate-spin text-slate-500 shrink-0" />
              ) : (
                <span className="shrink-0">Reopen</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
