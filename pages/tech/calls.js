"use client";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  memo,
} from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPhoneAlt,
  FaWhatsapp,
  FaDirections,
  FaCheck,
  FaClock,
  FaMapMarkerAlt,
  FaFileAlt,
  FaSyncAlt,
  FaSearch,
  FaCheckCircle,
  FaTimesCircle,
  FaRegClock,
  FaCalendarAlt,
} from "react-icons/fa";
import {
  FiX,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiSliders,
  FiFilter,
  FiMoreVertical,
  FiBarChart2,
  FiClock,
} from "react-icons/fi";
import { MdVerified } from "react-icons/md";
import { collection, query as fsQuery, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";

const TABS = [
  { id: "All Calls", label: "All", fullLabel: "All Calls", icon: FaPhoneAlt },
  { id: "Pending", label: "Pending", fullLabel: "Pending Calls", icon: FiClock },
  { id: "Closed", label: "Closed", fullLabel: "Closed Calls", icon: FaCheckCircle },
  { id: "Canceled", label: "Cancelled", fullLabel: "Cancelled", icon: FaTimesCircle },
];

const PAGE_SIZE = 10;

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
  const [tab, setTab] = useState("All Calls");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [globalCounts, setGlobalCounts] = useState({
    all: 0,
    pending: 0,
    closed: 0,
    canceled: 0,
  });

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

  // Fetch Calls with 10-per-page Backend Pagination
  const fetchCalls = useCallback(
    async (showNotify = false) => {
      if (!user) return;
      try {
        setRefreshing(true);
        const params = new URLSearchParams({
          tab,
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });

        const res = await fetch(`/api/tech/my-calls?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (data.success && Array.isArray(data.items)) {
          setCalls(data.items);
          if (data.totalPages !== undefined) setTotalPages(data.totalPages || 1);
          if (data.totalCount !== undefined) setTotalCount(data.totalCount || 0);
          if (data.counts) {
            setGlobalCounts(data.counts);
          }
        }

        if (showNotify) {
          toast.success("Calls Refreshed");
          vibrate([30]);
        }
      } catch (err) {
        console.error("fetch calls err:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, tab, page]
  );

  useEffect(() => {
    if (user) {
      fetchCalls();
    }
  }, [user, fetchCalls]);

  // Firestore Realtime Listener
  useEffect(() => {
    if (!user) return;
    const identifier = user.id || user._id || user.username;
    if (!identifier) return;

    let unsub = () => {};
    try {
      const q1 = fsQuery(
        collection(db, "forwarded_calls"),
        where("techId", "==", String(identifier)),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
      );

      unsub = onSnapshot(
        q1,
        (snapshot) => {
          if (!snapshot.empty) {
            const hasNew = snapshot.docChanges().some((c) => c.type === "added");
            if (hasNew) {
              playSound();
              vibrate([80, 40, 80]);
            }
            fetchCalls();
          }
        },
        () => {
          fetchCalls();
        }
      );
    } catch {
      fetchCalls();
    }

    return () => unsub();
  }, [user, fetchCalls]);

  // Memoized Handlers for 0ms Zero-Lag Tab Switching
  const handleShowDetails = useCallback((call) => {
    setDetailModalCall(call);
  }, []);

  const handleUpdateStatus = useCallback(
    async (callId, newStatus) => {
      if (!callId || !newStatus) return;

      const updateTime = new Date().toISOString();

      setCalls((prev) =>
        prev.map((c) =>
          c._id === callId
            ? {
                ...c,
                status: newStatus,
                updatedAt: updateTime,
                closedAt: newStatus === "Closed" ? updateTime : c.closedAt,
              }
            : c
        )
      );

      setUpdatingId(callId);
      vibrate([20]);

      try {
        const res = await fetch("/api/tech/calls/status", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId, status: newStatus }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to update status");
        }

        toast.success(
          newStatus === "Closed"
            ? "🎉 Call marked Closed!"
            : newStatus === "Canceled"
            ? "Call marked Canceled"
            : "Call status updated"
        );
        fetchCalls();
      } catch (err) {
        console.error("Status update error:", err);
        toast.error(err.message || "Failed to update status");
        fetchCalls();
      } finally {
        setUpdatingId(null);
      }
    },
    [fetchCalls]
  );

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
    return filterByQuery(calls);
  }, [calls, query]);

  return (
    <div className="min-h-screen bg-[#f8fafc] safe-bottom font-sans antialiased text-slate-800 select-none">
      <Header user={user} />

      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-3.5 space-y-3.5">
        {/* 1. TOP HEADER BAR: 100% 1 Single Line without Scroll on All Screens */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-2 sm:p-4 border border-slate-200/90 shadow-2xs w-full flex items-center justify-between gap-1 sm:gap-3">
          {/* User Profile & Verified Badge (Left) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
            <div className="h-8 w-8 sm:h-12 sm:w-12 rounded-full bg-slate-900 text-white font-bold grid place-items-center text-xs sm:text-base shrink-0 shadow-sm overflow-hidden ring-1.5 sm:ring-2 ring-slate-100">
              {user?.avatar ? (
                <img src={user.avatar} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="font-bold">{(user?.username || "K")[0].toUpperCase()}</span>
              )}
            </div>
            <div className="shrink-0 min-w-0">
              <div className="flex items-center gap-1">
                <h2 className="text-[11.5px] sm:text-base font-extrabold text-slate-900 leading-tight truncate">
                  {user?.username || user?.name || "Khan"}
                </h2>
                <MdVerified className="text-blue-600 text-xs sm:text-base shrink-0" />
              </div>
              <p className="text-[9px] sm:text-xs text-slate-400 font-medium whitespace-nowrap">
                {globalCounts.all || totalCount || calls.length} Calls Total
              </p>
            </div>
          </div>

          {/* 3 Stat Cards + 1 Slider Button (Right - Fits on 1 Line) */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            {/* Card 1: Pending Calls */}
            <button
              type="button"
              onClick={() => {
                setTab("Pending");
                setPage(1);
              }}
              className={`py-1 px-1.5 sm:py-2 sm:px-3.5 rounded-lg sm:rounded-2xl border transition-all text-center flex flex-col justify-center shrink-0 min-w-[50px] sm:min-w-[90px] relative overflow-hidden ${
                tab === "Pending"
                  ? "bg-blue-50/40 border-slate-200/90 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] sm:after:h-[2.5px] after:bg-blue-600 shadow-2xs"
                  : "bg-white border-slate-200/90 hover:bg-slate-50 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-slate-900 font-black text-[10px] sm:text-sm">
                <FaPhoneAlt size={8.5} className="text-blue-600 shrink-0" />
                <span>{globalCounts.pending || 0}</span>
              </div>
              <span className="text-[8px] sm:text-[11px] font-semibold text-blue-600 whitespace-nowrap mt-0.5">
                Pending Calls
              </span>
            </button>

            {/* Card 2: Closed Calls */}
            <button
              type="button"
              onClick={() => {
                setTab("Closed");
                setPage(1);
              }}
              className={`py-1 px-1.5 sm:py-2 sm:px-3.5 rounded-lg sm:rounded-2xl border transition-all text-center flex flex-col justify-center shrink-0 min-w-[48px] sm:min-w-[90px] relative overflow-hidden ${
                tab === "Closed"
                  ? "bg-emerald-50/40 border-slate-200/90 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] sm:after:h-[2.5px] after:bg-emerald-600 shadow-2xs"
                  : "bg-white border-slate-200/90 hover:bg-slate-50 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-slate-900 font-black text-[10px] sm:text-sm">
                <FaCheckCircle size={9.5} className="text-emerald-600 shrink-0" />
                <span>{globalCounts.closed || 0}</span>
              </div>
              <span className="text-[8px] sm:text-[11px] font-medium text-slate-600 whitespace-nowrap mt-0.5">
                Closed Calls
              </span>
            </button>

            {/* Card 3: Cancelled */}
            <button
              type="button"
              onClick={() => {
                setTab("Canceled");
                setPage(1);
              }}
              className={`py-1 px-1.5 sm:py-2 sm:px-3.5 rounded-lg sm:rounded-2xl border transition-all text-center flex flex-col justify-center shrink-0 min-w-[48px] sm:min-w-[90px] relative overflow-hidden ${
                tab === "Canceled"
                  ? "bg-purple-50/40 border-slate-200/90 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] sm:after:h-[2.5px] after:bg-purple-600 shadow-2xs"
                  : "bg-white border-slate-200/90 hover:bg-slate-50 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-slate-900 font-black text-[10px] sm:text-sm">
                <FaCalendarAlt size={9} className="text-purple-600 shrink-0" />
                <span>{globalCounts.canceled || 0}</span>
              </div>
              <span className="text-[8px] sm:text-[11px] font-medium text-slate-600 whitespace-nowrap mt-0.5">
                Cancelled
              </span>
            </button>

            {/* Slider Button */}
            <button
              type="button"
              onClick={() => fetchCalls(true)}
              disabled={refreshing}
              className="h-7 w-7 sm:h-11 sm:w-11 rounded-lg sm:rounded-2xl bg-white border border-slate-200/90 hover:bg-slate-50 active:scale-95 text-slate-600 grid place-items-center transition shadow-2xs shrink-0 cursor-pointer"
              title="Refresh Calls"
            >
              <FiSliders size={13} className="sm:text-base" />
            </button>
          </div>
        </div>

        {/* 2. SEARCH BAR WITH FILTERS BUTTON */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <FaSearch className="absolute left-3.5 top-3 sm:top-3.5 text-slate-400 text-xs sm:text-sm" />
            <input
              className="w-full bg-white border border-slate-200/90 rounded-2xl pl-9 pr-8 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 shadow-2xs transition"
              placeholder="Search by customer name or mobile number..."
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

          <button
            type="button"
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-2xl bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-2xs shrink-0 transition"
          >
            <FiFilter size={13} className="text-slate-500" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        {/* 3. 4 TAB BUTTONS (Smooth Horizontal Scroll, Full Text, Compact Sizing) */}
        <div className="w-full overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-max px-0.5">
            {TABS.map((t) => {
              const isActive = tab === t.id;
              const Icon = t.icon;
              const count =
                t.id === "Pending"
                  ? globalCounts.pending
                  : t.id === "Closed"
                  ? globalCounts.closed
                  : t.id === "Canceled"
                  ? globalCounts.canceled
                  : globalCounts.all;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    setPage(1);
                    vibrate([10]);
                  }}
                  className={`py-1.5 px-2.5 sm:py-2 sm:px-3.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-colors duration-75 flex items-center gap-1.5 select-none shrink-0 whitespace-nowrap ${
                    isActive
                      ? "bg-[#2563EB] text-white border border-[#2563EB] shadow-md shadow-blue-500/20"
                      : "bg-white text-slate-800 hover:bg-slate-50 border border-slate-200/90 shadow-2xs"
                  }`}
                >
                  {/* Icon */}
                  {t.id === "All Calls" ? (
                    <FaPhoneAlt
                      size={10}
                      className={`shrink-0 ${isActive ? "text-white" : "text-[#2563EB]"}`}
                    />
                  ) : t.id === "Pending" ? (
                    <span
                      className={`h-3.5 w-3.5 rounded-full border-1.5 border-orange-500 flex items-center justify-center shrink-0 ${
                        isActive ? "border-white" : "border-orange-500"
                      }`}
                    >
                      <FiClock
                        size={7.5}
                        className={isActive ? "text-white" : "text-orange-500"}
                      />
                    </span>
                  ) : t.id === "Closed" ? (
                    <FaCheckCircle
                      size={12}
                      className={`shrink-0 ${isActive ? "text-white" : "text-emerald-600"}`}
                    />
                  ) : (
                    <FaTimesCircle
                      size={12}
                      className={`shrink-0 ${isActive ? "text-white" : "text-purple-600"}`}
                    />
                  )}

                  {/* Full Label */}
                  <span className={isActive ? "text-white font-semibold" : "text-slate-800 font-semibold"}>
                    {t.label}
                  </span>

                  {/* Counter Badge */}
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0 ${
                      isActive
                        ? "bg-blue-500/60 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count !== undefined ? count : 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. CALLS FEED (10-per-page backend pagination) */}
        {loading ? (
          <div className="space-y-3 pt-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-44 rounded-3xl" />
            ))}
          </div>
        ) : visibleCalls.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/70 space-y-2 shadow-2xs">
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
            {visibleCalls.map((call) => (
              <PixelPerfectCallCard
                key={call._id}
                call={call}
                onShowDetails={handleShowDetails}
                onUpdateStatus={handleUpdateStatus}
                isUpdating={updatingId === call._id}
              />
            ))}
          </div>
        )}

        {/* 5. ULTRA-FAST 10-PER-PAGE PAGINATION BAR */}
        {!loading && totalPages > 1 && (
          <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            {/* Info text */}
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{(page - 1) * PAGE_SIZE + 1}</span> to{" "}
              <span className="font-bold text-slate-800">{Math.min(page * PAGE_SIZE, totalCount)}</span> of{" "}
              <span className="font-bold text-slate-800">{totalCount}</span> calls
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Prev Button */}
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => {
                  if (page > 1) {
                    setPage((p) => p - 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    vibrate([10]);
                  }
                }}
                className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition flex items-center gap-1 shadow-2xs ${
                  page <= 1
                    ? "bg-slate-50 text-slate-300 border-slate-200/60 cursor-not-allowed"
                    : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200 active:scale-95 cursor-pointer"
                }`}
              >
                <FiChevronLeft size={14} />
                <span>Prev</span>
              </button>

              {/* Page Number Pills */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pNum = i + 1;
                  if (totalPages > 5) {
                    if (page > 3 && page < totalPages - 1) {
                      pNum = page - 2 + i;
                    } else if (page >= totalPages - 1) {
                      pNum = totalPages - 4 + i;
                    }
                  }

                  const isCurrent = page === pNum;

                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => {
                        setPage(pNum);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        vibrate([10]);
                      }}
                      className={`h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-xs font-extrabold transition flex items-center justify-center cursor-pointer ${
                        isCurrent
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              {/* Next Button */}
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => {
                  if (page < totalPages) {
                    setPage((p) => p + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    vibrate([10]);
                  }
                }}
                className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition flex items-center gap-1 shadow-2xs ${
                  page >= totalPages
                    ? "bg-slate-50 text-slate-300 border-slate-200/60 cursor-not-allowed"
                    : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200 active:scale-95 cursor-pointer"
                }`}
              >
                <span>Next</span>
                <FiChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />

      {/* VIEW ALL DETAILS BOTTOM SHEET MODAL */}
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
                    <FaMapMarkerAlt size={9} /> Service Location Address
                  </div>
                  <div className="font-semibold text-slate-800 text-xs leading-relaxed break-words">
                    {detailModalCall.address || "Address not provided"}
                  </div>
                </div>

                {/* 3. Job Breakdown Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Service Amount</div>
                    <div className="text-sm font-extrabold text-emerald-600">₹{detailModalCall.price || 0}</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Current Status</div>
                    <div className="text-xs font-bold text-slate-900">{detailModalCall.status || "Pending"}</div>
                  </div>
                </div>

                {/* 4. Notes if available */}
                {detailModalCall.notes && (
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 space-y-1">
                    <div className="text-[10px] font-bold text-amber-900 uppercase">Admin Instructions / Notes</div>
                    <p className="text-xs text-amber-950 leading-relaxed font-medium break-words">
                      {detailModalCall.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDetailModalCall(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 active:scale-95 transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------------
// 🎴 PIXEL-PERFECT CARD COMPONENT (100% NON-BREAKING RESPONSIVE)
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

  const handleCopyPhone = (e) => {
    e.stopPropagation();
    if (!call.phone) return;
    navigator.clipboard.writeText(call.phone);
    toast.success("Phone number copied! 📋");
  };

  const chooseRaw = (call.chooseLabel || call.chooseCall || call.type || "chimney").toString().toLowerCase();

  // Compute initials
  const getInitials = (name) => {
    if (!name) return "CS";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(call.clientName);

  return (
    <div
      className={`bg-white rounded-3xl p-3.5 sm:p-5 border border-slate-200/90 shadow-2xs space-y-2.5 sm:space-y-3 relative overflow-hidden transition-all ${
        isClosed
          ? "border-l-4 border-l-emerald-500"
          : isCanceled
          ? "border-l-4 border-l-purple-500"
          : "border-l-4 border-l-rose-500"
      }`}
    >
      {/* 1. Header Bar: Status Pill + Service Tag + Price + More Icon (NO WRAPPING) */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="shrink-0">
          {isPending && (
            <span className="bg-rose-50 border border-rose-200 text-rose-600 font-extrabold text-[9.5px] sm:text-[10.5px] uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600 inline-block" />
              PENDING CALL
            </span>
          )}
          {isClosed && (
            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-[9.5px] sm:text-[10.5px] uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 inline-block" />
              CLOSED CALL
            </span>
          )}
          {isCanceled && (
            <span className="bg-purple-50 border border-purple-200 text-purple-700 font-extrabold text-[9.5px] sm:text-[10.5px] uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-600 inline-block" />
              CANCELLED
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Service Tag */}
          <span className="bg-blue-50 text-blue-600 font-bold text-[10.5px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl whitespace-nowrap max-w-[120px] sm:max-w-none truncate">
            {chooseRaw}
          </span>

          {/* Price Badge */}
          <span className="bg-slate-100 text-slate-900 font-black text-xs sm:text-sm px-2.5 py-0.5 sm:py-1 rounded-xl whitespace-nowrap">
            ₹{call.price || 0}
          </span>

          {/* More Icon */}
          <button
            type="button"
            onClick={() => onShowDetails(call)}
            className="h-7 w-7 rounded-lg hover:bg-slate-100 grid place-items-center text-slate-400 hover:text-slate-700 transition shrink-0 cursor-pointer"
          >
            <FiMoreVertical size={15} />
          </button>
        </div>
      </div>

      {/* 2. Middle Row: Left Customer Details & Right 4 Action Buttons (Exact Replica) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-0.5">
        {/* Customer Details Column */}
        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
          {/* Avatar Initials Circle */}
          <div
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full grid place-items-center font-extrabold text-xs sm:text-sm shrink-0 shadow-2xs ${
              isClosed
                ? "bg-emerald-100 text-emerald-700"
                : isCanceled
                ? "bg-purple-100 text-purple-700"
                : "bg-rose-100 text-rose-600"
            }`}
          >
            {initials}
          </div>

          <div className="space-y-0.5 min-w-0 flex-1">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight truncate">
              {call.clientName || "Customer"}
            </h3>

            {/* Phone with copy */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <FaPhoneAlt size={9.5} className="text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800 truncate">{call.phone}</span>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="text-slate-400 hover:text-slate-700 p-0.5 shrink-0 cursor-pointer"
                title="Copy Phone"
              >
                <FiCopy size={11} />
              </button>
            </div>

            {/* Address */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
              <FaMapMarkerAlt size={10} className="text-slate-400 shrink-0" />
              <span className="truncate">{call.address || "Address not specified"}</span>
            </div>

            {/* Timestamp */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5 truncate">
              <FaClock size={9.5} className="shrink-0" />
              <span className="truncate">
                {isClosed && call.closedAt
                  ? `Closed ${timeAgo(call.closedAt)}`
                  : isCanceled
                  ? `Cancelled ${timeAgo(call.updatedAt || call.createdAt)}`
                  : `Assigned ${timeAgo(call.createdAt)}`}
                {call.timeZone && ` • Slot: ${call.timeZone}`}
              </span>
            </div>
          </div>
        </div>

        {/* 3. 4 Action Buttons Grid (Call, Map, Chat, Details - ALWAYS 100% ENABLED) */}
        <div className="grid grid-cols-4 md:flex md:items-center gap-1.5 sm:gap-2 shrink-0 w-full md:w-auto">
          {/* 📞 Call */}
          <a
            href={`tel:${cleanPhone}`}
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2 sm:px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition text-center whitespace-nowrap cursor-pointer active:scale-95"
          >
            <FaPhoneAlt size={10} className="text-emerald-600 shrink-0" />
            <span>Call</span>
          </a>

          {/* 🗺️ Map */}
          <button
            type="button"
            onClick={handleNavigate}
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2 sm:px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition text-center whitespace-nowrap cursor-pointer active:scale-95"
          >
            <FaDirections size={11} className="text-blue-600 shrink-0" />
            <span>Map</span>
          </button>

          {/* 💬 Chat */}
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2 sm:px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition text-center whitespace-nowrap cursor-pointer active:scale-95"
          >
            <FaWhatsapp size={11} className="text-[#25D366] shrink-0" />
            <span>Chat</span>
          </button>

          {/* 📄 Details */}
          <button
            type="button"
            onClick={() => onShowDetails(call)}
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2 sm:px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition active:scale-95 text-center whitespace-nowrap cursor-pointer"
          >
            <FaFileAlt size={10} className="text-purple-600 shrink-0" />
            <span>Details</span>
          </button>
        </div>
      </div>

      {/* 4. Bottom Row: Interactive Status Option Dropdown (No right-side button) */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
        {/* Status Dropdown Option Button */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 tracking-wider uppercase shrink-0">
            STATUS
          </span>
          <div className="relative inline-flex items-center shrink-0">
            <select
              value={isClosed ? "Closed" : isCanceled ? "Canceled" : "Pending"}
              disabled={isUpdating}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "Canceled" && !confirm("Are you sure you want to cancel this call?")) return;
                onUpdateStatus(call._id, val);
              }}
              className={`appearance-none text-[11px] sm:text-xs font-bold py-1.5 pl-2.5 pr-7 rounded-xl border transition-all cursor-pointer focus:outline-none shadow-2xs whitespace-nowrap ${
                isClosed
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isCanceled
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              <option value="Pending">● Pending</option>
              <option value="Closed">✓ Closed</option>
              <option value="Canceled">● Cancelled</option>
            </select>
            <FiChevronDown
              size={12}
              className={`absolute right-2 pointer-events-none ${
                isClosed ? "text-emerald-700" : isCanceled ? "text-purple-700" : "text-rose-700"
              }`}
            />
          </div>
        </div>

        {/* Loading Spinner if updating status */}
        {isUpdating && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold shrink-0">
            <FaSyncAlt size={10} className="animate-spin text-blue-600" />
            <span>Updating...</span>
          </div>
        )}
      </div>
    </div>
  );
});
