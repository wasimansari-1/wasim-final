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
import { FiX } from "react-icons/fi";
import { collection, query as fsQuery, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";

const TABS = [
  { id: "All Calls", label: "All Calls", icon: FaPhoneAlt },
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
          <FaSearch className="absolute left-3 top-2.5 text-slate-400 text-[11px]" />
          <input
            className="w-full bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl pl-8 pr-8 py-1.5 sm:py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 shadow-2xs transition"
            placeholder="Search by client name, mobile, address..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-0.5"
            >
              <FiX size={13} />
            </button>
          )}
        </div>

        {/* Fluid Animated Scrolling Tab Bar */}
        <div className="w-full overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-max px-0.5">
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
                  onClick={() => {
                    setTab(t.id);
                    vibrate([15]);
                  }}
                  className={`relative px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-bold transition-colors duration-150 flex items-center gap-1.5 select-none shrink-0 ${
                    isActive ? "text-white" : "text-slate-600 bg-white hover:bg-slate-50 border border-slate-200/80 shadow-xs"
                  }`}
                >
                  {/* Sliding Spring Background Pill */}
                  {isActive && (
                    <motion.div
                      layoutId="activeCallTabPill"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      className={`absolute inset-0 rounded-xl sm:rounded-2xl shadow-md ${
                        t.id === "Pending"
                          ? "bg-gradient-to-r from-amber-500 to-rose-500 shadow-amber-500/20"
                          : t.id === "Closed"
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-600/20"
                          : t.id === "Canceled"
                          ? "bg-slate-700 shadow-slate-700/20"
                          : "bg-slate-900 shadow-slate-900/20"
                      }`}
                    />
                  )}

                  {/* Tab Label & Icon */}
                  <span className="relative z-10 flex items-center gap-1">
                    <Icon size={10} className={isActive ? "text-white" : "text-slate-400"} />
                    <span className="tracking-tight">{t.label}</span>
                  </span>

                  {/* Counter Pill */}
                  {count > 0 && (
                    <span
                      className={`relative z-10 px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black ${
                        isActive
                          ? "bg-white/25 text-white"
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

        {/* Calls Feed */}
        {loading ? (
          <div className="space-y-3 pt-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-40 rounded-3xl" />
            ))}
          </div>
        ) : visibleCalls.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/70 space-y-2 shadow-sm">
            <div className="h-10 w-10 bg-slate-50 text-slate-400 rounded-2xl grid place-items-center text-lg mx-auto">
              📋
            </div>
            <h3 className="font-bold text-slate-800 text-xs">No Calls in {tab}</h3>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              There are no customer records matching this filter.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-0.5">
            <AnimatePresence mode="popLayout">
              {visibleCalls.map((call) => (
                <PixelPerfectCallCard
                  key={call._id}
                  call={call}
                  onShowDetails={() => setDetailModalCall(call)}
                  onUpdateStatus={updateStatus}
                  isUpdating={updatingId === call._id}
                />
              ))}
            </AnimatePresence>
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
const PixelPerfectCallCard = memo(
  forwardRef(function PixelPerfectCallCard(
    { call, onShowDetails, onUpdateStatus, isUpdating },
    ref
  ) {
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
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className={`rounded-3xl p-3.5 sm:p-4 border transition-all duration-200 space-y-2.5 relative ${
          isClosed
            ? "bg-gradient-to-b from-emerald-50/50 via-white to-white border-emerald-200/90 shadow-[0_4px_20px_rgba(16,185,129,0.06)]"
            : isCanceled
            ? "bg-gradient-to-b from-slate-100/60 via-white to-white border-slate-200/90 shadow-[0_4px_20px_rgba(15,23,42,0.03)] opacity-85"
            : "bg-gradient-to-b from-rose-50/50 via-white to-white border-rose-200/90 shadow-[0_4px_20px_rgba(244,63,94,0.06)]"
        }`}
      >
        {/* 1. Header Bar: Brand + Status Pill + Price */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Status Indicator */}
            {isPending && (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-200 text-[10px] font-black flex items-center gap-1.5 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping inline-block" />
                Pending Call
              </span>
            )}

            {isClosed && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-black flex items-center gap-1 shadow-sm">
                <FaCheck size={8} className="text-emerald-700" />
                Closed
              </span>
            )}

            {isCanceled && (
              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300 text-[10px] font-bold">
                ✕ Canceled
              </span>
            )}

            {/* Brand Source */}
            {chooseRaw && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                {chooseRaw.replace(/_/g, " ")}
              </span>
            )}
          </div>

          <div className="text-right shrink-0">
            <span className="text-sm sm:text-base font-extrabold text-slate-900">₹{call.price || 0}</span>
          </div>
        </div>

        {/* 2. Customer Body (No broken text) */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug break-words">
              {call.clientName || "Customer"}
            </h3>
            {call.type && (
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md shrink-0">
                {call.type}
              </span>
            )}
          </div>

          {/* Contact & Address */}
          <div className="space-y-0.5 pt-0.5">
            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 break-all">
              <FaPhoneAlt size={9} className="text-slate-400 shrink-0" />
              <span>{call.phone}</span>
            </div>

            <div className="text-xs text-slate-600 flex items-start gap-1.5 leading-relaxed break-words">
              <FaMapMarkerAlt size={10} className="text-slate-400 shrink-0 mt-0.5" />
              <span>{call.address || "Address not specified"}</span>
            </div>
          </div>

          {/* Notes */}
          {call.notes && (
            <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200/60 text-[11px] text-amber-950 font-medium leading-snug break-words">
              <b className="font-bold">Note:</b> {call.notes}
            </div>
          )}

          {/* Time Stamp */}
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-0.5">
            <FaClock size={9} />
            <span>Assigned {timeAgo(call.createdAt)}</span>
            {call.timeZone && <span>• Slot: {call.timeZone}</span>}
          </div>

          {/* Closure Audit Tag if Closed */}
          {isClosed && call.closedAt && (
            <div className="p-1.5 rounded-xl bg-emerald-100/60 text-emerald-900 text-[10px] font-bold flex items-center gap-1.5 border border-emerald-200">
              <FaCheck size={9} className="text-emerald-700" />
              <span>Closed on {formatFullDate(call.closedAt)}</span>
            </div>
          )}
        </div>

        {/* 3. 100% Solid Action Buttons Grid (Call, Maps, WhatsApp, Details) */}
        <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-100">
          {/* 📞 Direct Call */}
          <a
            href={`tel:${cleanPhone}`}
            className="flex items-center justify-center gap-1 py-2 px-1 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 text-xs font-bold rounded-xl transition text-center"
            title="Direct Phone Call"
          >
            <FaPhoneAlt size={9} />
            <span>Call</span>
          </a>

          {/* 🗺️ Google Maps */}
          <button
            type="button"
            onClick={handleNavigate}
            className="flex items-center justify-center gap-1 py-2 px-1 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 text-xs font-bold rounded-xl transition text-center"
            title="Open Location in Google Maps"
          >
            <FaDirections size={10} />
            <span>Map</span>
          </button>

          {/* 💬 WhatsApp */}
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-1 py-2 px-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 active:scale-95 text-[#128C7E] text-xs font-bold rounded-xl transition text-center"
            title="Open WhatsApp Chat"
          >
            <FaWhatsapp size={11} className="text-[#25D366]" />
            <span>Chat</span>
          </button>

          {/* 👁️ View All Details */}
          <button
            type="button"
            onClick={onShowDetails}
            className="flex items-center justify-center gap-1 py-2 px-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold rounded-xl transition text-center"
            title="View Full Call Details"
          >
            <FaEye size={10} />
            <span>Details</span>
          </button>
        </div>

        {/* 4. Full Status Selector & Quick Action Strip */}
        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Status Dropdown Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400">Status:</span>
            <select
              value={isClosed ? "Closed" : isCanceled ? "Canceled" : "Pending"}
              disabled={isUpdating}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "Canceled" && !confirm("Are you sure you want to cancel this call?")) return;
                onUpdateStatus(call._id, val);
              }}
              className={`text-[11px] font-bold py-1 px-2 rounded-xl border transition-all cursor-pointer focus:outline-none ${
                isClosed
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : isCanceled
                  ? "bg-slate-100 text-slate-700 border-slate-300"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              <option value="Pending">● Pending</option>
              <option value="Closed">✓ Closed</option>
              <option value="Canceled">✕ Canceled</option>
            </select>
          </div>

          {/* Quick 1-Tap Action Button */}
          <div className="flex items-center gap-1">
            {!isClosed ? (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(call._id, "Closed")}
                className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold rounded-xl shadow-sm transition flex items-center gap-1"
              >
                <FaCheck size={8} /> Close Call
              </button>
            ) : (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(call._id, "Pending")}
                className="py-1 px-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[10px] font-bold rounded-xl border border-slate-200 transition"
              >
                Reopen
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  })
);
