// pages/tech/profile.js
import { useEffect, useState, useCallback, useRef } from "react";
import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { FiCamera, FiTrash2, FiAward, FiDollarSign, FiPhoneCall, FiStar, FiCalendar } from "react-icons/fi";
import toast from "react-hot-toast";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [avatarPublicId, setAvatarPublicId] = useState(null);
  const [calls, setCalls] = useState([]);

  const [mode, setMode] = useState("month");
  const [date, setDate] = useState(new Date());
  const [totalCalls, setTotalCalls] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [display, setDisplay] = useState(0);

  /* crop */
  const [cropOpen, setCropOpen] = useState(false);
  const [img, setImg] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPx, setCropPx] = useState(null);
  const inputRef = useRef();

  /* upload */
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (!me.ok) return (window.location.href = "/login");
        const u = await me.json();
        if (u.role !== "technician") return (window.location.href = "/login");
        setUser(u);
        setAvatar(u.avatar || null);
        setAvatarPublicId(u.avatarPublicId || null);
      } catch {
        window.location.href = "/login";
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/tech/my-calls?pageSize=1000", { credentials: "same-origin" });
        const d = await r.json();
        setCalls(d.items || []);
      } catch {
        setCalls([]);
      }
    })();
  }, []);

  useEffect(() => {
    let from, to;
    const d = new Date(date);
    if (mode === "day") {
      from = new Date(d);
      from.setHours(0, 0, 0, 0);
      to = new Date(d);
      to.setHours(23, 59, 59, 999);
    } else if (mode === "week") {
      from = startOfWeek(d, { weekStartsOn: 1 });
      to = endOfWeek(d, { weekStartsOn: 1 });
    } else if (mode === "month") {
      from = startOfMonth(d);
      to = endOfMonth(d);
    } else {
      from = new Date(0);
      to = new Date();
    }

    const filtered = calls.filter((c) => {
      const cd = new Date(c.createdAt);
      return cd >= from && cd <= to;
    });

    const t = filtered.length;
    const e = t * 100;

    setTotalCalls(t);
    setEarnings(e);
    animateCount(e);
  }, [mode, date, calls]);

  function animateCount(target) {
    let cur = 0;
    const step = Math.max(1, Math.floor(target / 25));
    const i = setInterval(() => {
      cur += step;
      if (cur >= target) {
        setDisplay(target);
        clearInterval(i);
      } else {
        setDisplay(cur);
      }
    }, 18);
  }

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCropPx(croppedAreaPixels);
  }, []);

  async function getCroppedImg(imageSrc, pixelCrop) {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => (image.onload = resolve));
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

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Canvas empty"));
        resolve(blob);
      }, "image/jpeg", 0.9);
    });
  }

  async function saveImage() {
    if (!img || !cropPx) return;
    const prevAvatar = avatar;
    const prevPublicId = avatarPublicId;

    try {
      setCropOpen(false);
      setUploading(true);
      setProgress(15);

      const croppedBlob = await getCroppedImg(img, cropPx);
      const reader = new FileReader();
      reader.readAsDataURL(croppedBlob);

      reader.onloadend = async () => {
        setProgress(40);
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: reader.result,
              old_public_id: prevPublicId,
            }),
          });

          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();

          setProgress(85);
          const saveRes = await fetch("/api/tech/profile", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              avatar: data.secure_url,
              avatarPublicId: data.public_id,
            }),
          });

          if (!saveRes.ok) throw new Error("Profile save failed");

          setAvatar(data.secure_url);
          setAvatarPublicId(data.public_id);
          setProgress(100);
          toast.success("Profile photo updated successfully ✨");
        } catch (e) {
          toast.error("Upload failed");
        } finally {
          setUploading(false);
        }
      };
    } catch (err) {
      toast.error("Image processing error");
      setUploading(false);
    }
  }

  async function handleDeleteAvatar() {
    if (!confirm("Are you sure you want to remove your profile photo?")) return;

    try {
      await fetch("/api/tech/delete-avatar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: avatarPublicId }),
      });

      setAvatar(null);
      setAvatarPublicId(null);
      toast.success("Profile photo removed");
    } catch {
      toast.error("Could not remove photo");
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 safe-bottom">
      <Header user={user} />

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Profile Info Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
          <div className="relative">
            <div className="w-32 h-32 rounded-3xl p-1 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 shadow-xl">
              <div className="w-full h-full rounded-[22px] bg-white overflow-hidden grid place-items-center">
                {avatar ? (
                  <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-extrabold text-blue-600">
                    {(user.username || "T")[0].toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => inputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-2.5 bg-blue-600 text-white rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition"
              title="Change Photo"
            >
              <FiCamera size={16} />
            </button>

            {avatar && (
              <button
                onClick={handleDeleteAvatar}
                className="absolute -top-2 -right-2 p-2 bg-red-50 text-red-600 rounded-2xl shadow border border-red-200 hover:bg-red-100 transition"
                title="Remove Photo"
              >
                <FiTrash2 size={14} />
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

          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center justify-center gap-2">
              <span>{user.username}</span>
              <span className="inline-flex items-center text-blue-500" title="Verified Technician">
                <FiAward />
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Certified Chimney Solutions Technician</p>
          </div>

          {/* Quick Metrics Grid */}
          <div className="w-full grid grid-cols-3 gap-2 sm:gap-3 pt-2">
            <StatCard icon={<FiPhoneCall />} label="Total Calls" value={calls.length} color="text-blue-600" />
            <StatCard icon={<FiDollarSign />} label="Commission" value={`₹${earnings}`} color="text-emerald-600" />
            <StatCard icon={<FiStar />} label="Rating" value="5.0 ★" color="text-amber-500" />
          </div>
        </div>

        {/* Performance & Earnings Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h2 className="font-extrabold text-base text-slate-900">Performance & Earnings</h2>
              <p className="text-xs text-slate-500">Track your completed jobs and commissions.</p>
            </div>

            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="input bg-white text-xs py-1.5 px-3 w-auto border-slate-200 font-bold"
            >
              <option value="day">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>

          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 text-white shadow-xl text-center space-y-2 relative overflow-hidden">
            <div className="text-xs uppercase font-bold text-blue-200 tracking-wider">
              {mode.toUpperCase()} EARNINGS
            </div>
            <div className="text-4xl sm:text-5xl font-black tracking-tight">₹{display}</div>
            <div className="text-xs text-blue-100 opacity-90">
              {totalCalls} calls recorded in this period
            </div>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* CROP MODAL */}
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
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={saveImage}
                  className="px-6 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700"
                >
                  Save Photo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-100 text-center space-y-1">
      <div className={`text-base mx-auto ${color}`}>{icon}</div>
      <div className="font-extrabold text-sm sm:text-base text-slate-900">{value}</div>
      <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase">{label}</div>
    </div>
  );
}
