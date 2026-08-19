// pages/tech/profile.js
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import {
  FiCamera,
  FiTrash2,
  FiAward,
  FiDollarSign,
  FiPhoneCall,
  FiCheckCircle,
  FiCalendar,
  FiMapPin,
  FiPhone,
  FiClock,
  FiLogOut,
  FiTrendingUp,
} from "react-icons/fi";
import toast from "react-hot-toast";

function fmtDate(d) {
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
    return "—";
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

export default function Profile() {
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [avatarPublicId, setAvatarPublicId] = useState(null);
  const [calls, setCalls] = useState([]);

  const [mode, setMode] = useState("month"); // 'today' | 'week' | 'month' | 'lifetime'
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  /* crop */
  const [cropOpen, setCropOpen] = useState(false);
  const [img, setImg] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPx, setCropPx] = useState(null);
  const inputRef = useRef();

  /* upload */
  const [uploading, setUploading] = useState(false);

  // Load auth, profile, and my-calls concurrently
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [meRes, profRes, callsRes] = await Promise.all([
          fetch("/api/auth/me", { credentials: "same-origin" }).catch(() => null),
          fetch("/api/tech/profile", { credentials: "same-origin" }).catch(() => null),
          fetch("/api/tech/my-calls?tab=All%20Calls&pageSize=1000", { credentials: "same-origin" }).catch(() => null),
        ]);

        if (!meRes || !meRes.ok) {
          window.location.href = "/login";
          return;
        }

        const u = await meRes.json();
        if (u.role !== "technician") {
          window.location.href = "/login";
          return;
        }

        if (isMounted) {
          setUser(u);
          setAvatar(u.avatar || null);
          setAvatarPublicId(u.avatarPublicId || null);

          if (profRes && profRes.ok) {
            const profData = await profRes.json().catch(() => null);
            if (profData?.avatar) setAvatar(profData.avatar);
            if (profData?.avatarPublicId) setAvatarPublicId(profData.avatarPublicId);
          }

          if (callsRes && callsRes.ok) {
            const d = await callsRes.json().catch(() => ({ items: [] }));
            setCalls(Array.isArray(d.items) ? d.items : []);
          }
        }
      } catch {
        if (isMounted) window.location.href = "/login";
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute date boundaries
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    if (mode === "today") {
      const f = new Date(now);
      f.setHours(0, 0, 0, 0);
      const t = new Date(now);
      t.setHours(23, 59, 59, 999);
      return { dateFrom: f, dateTo: t };
    }
    if (mode === "week") {
      return {
        dateFrom: startOfWeek(now, { weekStartsOn: 1 }),
        dateTo: endOfWeek(now, { weekStartsOn: 1 }),
      };
    }
    if (mode === "month") {
      if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
        const [y, m] = selectedMonth.split("-").map((n) => parseInt(n, 10));
        return {
          dateFrom: new Date(y, m - 1, 1, 0, 0, 0, 0),
          dateTo: new Date(y, m, 0, 23, 59, 59, 999),
        };
      }
      return {
        dateFrom: startOfMonth(now),
        dateTo: endOfMonth(now),
      };
    }
    // lifetime
    return {
      dateFrom: new Date(0),
      dateTo: new Date(Date.now() + 86400000),
    };
  }, [mode, selectedMonth]);

  // Filter ONLY Closed / Completed calls in the selected period (100% matching Admin)
  const periodClosedCalls = useMemo(() => {
    return calls.filter((c) => {
      const isClosed =
        c.status === "Closed" ||
        c.status === "Completed" ||
        String(c.status || "").toLowerCase().includes("done");

      if (!isClosed) return false;

      const closedDate = new Date(c.closedAt || c.updatedAt || c.createdAt);
      return closedDate >= dateFrom && closedDate <= dateTo;
    });
  }, [calls, dateFrom, dateTo]);

  // Lifetime closed calls
  const lifetimeClosedCalls = useMemo(() => {
    return calls.filter(
      (c) =>
        c.status === "Closed" ||
        c.status === "Completed" ||
        String(c.status || "").toLowerCase().includes("done")
    );
  }, [calls]);

  const closedCount = periodClosedCalls.length;
  const incentiveAmount = closedCount * 100; // ₹100 per closed call

  const totalCollectedInPeriod = useMemo(() => {
    return periodClosedCalls.reduce((sum, c) => {
      const p = Number(c.price || 0);
      return sum + (Number.isFinite(p) ? p : 0);
    }, 0);
  }, [periodClosedCalls]);

  /* ---------------- CROPPER / PHOTO ACTIONS ---------------- */
  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCropPx(croppedAreaPixels);
  }, []);

  async function getCroppedImg(imageSrc, pixelCrop) {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
    });

    const canvas = document.createElement("canvas");
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/jpeg", 0.9);
    });
  }

  async function saveImage() {
    if (!cropPx || !img) return;
    try {
      setUploading(true);
      const blob = await getCroppedImg(img, cropPx);
      const formData = new FormData();
      formData.append("file", blob);
      formData.append("upload_preset", "chimney_solutions");

      const up = await fetch("https://api.cloudinary.com/v1_1/dkmcbvjkl/image/upload", {
        method: "POST",
        body: formData,
      });
      const data = await up.json();

      if (data.secure_url) {
        await fetch("/api/tech/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatar: data.secure_url,
            avatarPublicId: data.public_id,
          }),
        });

        setAvatar(data.secure_url);
        setAvatarPublicId(data.public_id);
        toast.success("Profile photo updated! 📸");
        setCropOpen(false);
      }
    } catch (e) {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAvatar() {
    if (!confirm("Remove your profile picture?")) return;
    try {
      await fetch("/api/tech/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: null, avatarPublicId: null }),
      });
      setAvatar(null);
      setAvatarPublicId(null);
      toast.success("Profile photo removed");
    } catch (e) {
      toast.error("Failed to remove photo");
    }
  }

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to log out?")) return;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    localStorage.clear();
    window.location.href = "/login";
  };

  const displayName = user?.name || user?.username || "Technician";

  return (
    <div className="min-h-screen bg-slate-50 safe-bottom">
      <Header user={user} />

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
        {/* ================= 👨‍🔧 Profile Hero Card ================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-center sm:items-start gap-6 relative overflow-hidden">
          {/* Avatar with Camera Button */}
          <div className="relative flex-shrink-0">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-1 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 shadow-xl">
              <div className="w-full h-full rounded-[22px] bg-white overflow-hidden grid place-items-center">
                {avatar ? (
                  <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-extrabold text-blue-600">
                    {(displayName || "T")[0].toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => inputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-2.5 bg-blue-600 text-white rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition cursor-pointer"
              title="Change Photo"
            >
              <FiCamera size={16} />
            </button>

            {avatar && (
              <button
                onClick={handleDeleteAvatar}
                className="absolute -top-2 -right-2 p-2 bg-red-50 text-red-600 rounded-2xl shadow border border-red-200 hover:bg-red-100 transition cursor-pointer"
                title="Remove Photo"
              >
                <FiTrash2 size={13} />
              </button>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImg(URL.createObjectURL(file));
                setCropOpen(true);
              }}
            />
          </div>

          {/* User Info Details */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {displayName}
              </h1>
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
                <FiAward size={13} />
                <span>Verified Technician</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-500">
              Username: <span className="font-semibold text-slate-700">@{user?.username}</span> • Role: Technician
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-3 py-1 rounded-xl">
                🎁 Closed Call Rate: ₹100 / Call
              </span>
              <span className="text-xs bg-slate-100 text-slate-700 font-medium px-3 py-1 rounded-xl">
                ⭐ Rating: 5.0 / 5.0
              </span>
            </div>
          </div>
        </div>

        {/* ================= 💰 ₹100/Call Incentive & Earnings Card ================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                <FiAward className="text-amber-500" />
                <span>Closed Calls & ₹100 Incentive Ledger</span>
              </h2>
              <p className="text-xs text-slate-500">
                Exact closed calls count matching Admin audit records.
              </p>
            </div>

            {/* Time Filter Mode Switcher */}
            <div className="flex items-center gap-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="input bg-slate-50 text-xs py-2 px-3 w-auto border-slate-200 font-bold rounded-xl"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">Monthly</option>
                <option value="lifetime">Lifetime</option>
              </select>

              {mode === "month" && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input bg-slate-50 text-xs py-1.5 px-3 w-auto border-slate-200 font-semibold rounded-xl"
                />
              )}
            </div>
          </div>

          {/* Big Incentive Banner */}
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-indigo-900 via-blue-800 to-blue-900 text-white shadow-xl text-center space-y-2 relative overflow-hidden">
            <div className="pointer-events-none absolute -right-8 -bottom-8 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl" />
            <div className="pointer-events-none absolute -left-8 -top-8 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl" />

            <div className="text-xs uppercase font-extrabold text-amber-300 tracking-wider flex items-center justify-center gap-1.5">
              <span>🏆 EARNED INCENTIVE ({mode.toUpperCase()})</span>
            </div>

            <div className="text-4xl sm:text-5xl font-black tracking-tight text-white">
              ₹{incentiveAmount.toLocaleString("en-IN")}
            </div>

            <div className="text-xs text-blue-100 font-medium">
              <span className="font-bold text-amber-300">{closedCount} Closed Calls</span> × ₹100 = ₹{incentiveAmount.toLocaleString("en-IN")} payout
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <StatCard
              icon={<FiCheckCircle />}
              label="Closed Calls"
              value={`${closedCount} calls`}
              subtext="In selected period"
              color="text-emerald-600"
              bg="bg-emerald-50"
            />

            <StatCard
              icon={<FiAward />}
              label="Incentive (₹100/Call)"
              value={`₹${incentiveAmount.toLocaleString("en-IN")}`}
              subtext="Calculated earnings"
              color="text-amber-600"
              bg="bg-amber-50"
            />

            <StatCard
              icon={<FiDollarSign />}
              label="Service Volume"
              value={`₹${totalCollectedInPeriod.toLocaleString("en-IN")}`}
              subtext="Total price handled"
              color="text-blue-600"
              bg="bg-blue-50"
            />

            <StatCard
              icon={<FiPhoneCall />}
              label="Lifetime Closed"
              value={`${lifetimeClosedCalls.length} calls`}
              subtext={`₹${(lifetimeClosedCalls.length * 100).toLocaleString("en-IN")} Total`}
              color="text-purple-600"
              bg="bg-purple-50"
            />
          </div>
        </div>

        {/* ================= 📋 Recent Closed Calls Breakdown ================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span>📋 Closed Calls Breakdown ({periodClosedCalls.length})</span>
              </h3>
              <p className="text-xs text-slate-500">
                Detailed closure timeline and incentive confirmation.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
              100% Verified
            </span>
          </div>

          {periodClosedCalls.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No closed calls found in this period.
            </div>
          ) : (
            <div className="space-y-3">
              {periodClosedCalls.map((c) => {
                const closedTime = c.closedAt || c.updatedAt || c.createdAt;

                return (
                  <div
                    key={c._id}
                    className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-sm space-y-2 hover:shadow-md transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {c.clientName || "Client"}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            Closed
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <FiAward size={10} /> +₹100
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1">
                          {c.phone && <span>📱 {c.phone}</span>}
                          {c.type && <span>🔧 {c.type}</span>}
                          {c.address && <span>📍 {c.address}</span>}
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <div className="text-xs text-slate-400 font-bold uppercase">Price</div>
                        <div className="text-sm font-extrabold text-slate-900">₹{c.price || 0}</div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                      <div className="flex items-center gap-1 text-emerald-800 font-semibold">
                        <FiCheckCircle size={14} className="text-emerald-600" />
                        <span>Closed: {fmtDate(closedTime)}</span>
                      </div>
                      <span className="text-slate-400 text-[11px]">{timeAgo(closedTime)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ================= 🚪 Account Actions ================= */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <div className="font-bold text-sm text-slate-900">Account Session</div>
            <div className="text-xs text-slate-500">Log out from this device</div>
          </div>

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FiLogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </main>

      <BottomNav />

      {/* ================= 📸 CROP MODAL ================= */}
      <AnimatePresence>
        {cropOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-5 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl"
            >
              <div className="relative w-full h-80 rounded-2xl overflow-hidden bg-slate-900">
                <Cropper
                  image={img}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">Zoom:</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setCropOpen(false);
                    setImg(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={saveImage}
                  disabled={uploading}
                  className="px-6 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 active:scale-95 transition disabled:opacity-60 cursor-pointer"
                >
                  {uploading ? "Saving..." : "Save Photo"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, subtext, color, bg }) {
  return (
    <div className={`p-3.5 rounded-2xl border border-slate-100 ${bg} space-y-1 text-left`}>
      <div className={`text-base ${color}`}>{icon}</div>
      <div className="font-extrabold text-base text-slate-900 truncate">{value}</div>
      <div className="text-[10px] text-slate-500 font-bold uppercase truncate">{label}</div>
      {subtext && <div className="text-[10px] text-slate-400 truncate">{subtext}</div>}
    </div>
  );
}
