"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSend, FiX, FiBell, FiUsers, FiUser, FiLink, FiCheckCircle } from "react-icons/fi";
import toast from "react-hot-toast";

const PRESET_TITLES = [
  "⚡ Urgent Call Assigned",
  "📢 Admin Announcement",
  "💰 Payment Reminder",
  "🔧 App Maintenance",
  "🌟 Great Work Team!",
];

export default function CustomNotificationModal({ isOpen, onClose }) {
  const [techs, setTechs] = useState([]);
  const [target, setTarget] = useState("all");
  const [selectedTech, setSelectedTech] = useState("");
  const [title, setTitle] = useState("📢 Admin Announcement");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/tech/calls");
  const [sending, setSending] = useState(false);
  const [successResult, setSuccessResult] = useState(null);

  // Fetch technician list
  useEffect(() => {
    if (!isOpen) return;
    setSuccessResult(null);

    (async () => {
      try {
        const res = await fetch("/api/admin/techs");
        const d = await res.json();
        setTechs(d.items || []);
      } catch (err) {
        console.error("Failed to load techs:", err);
      }
    })();
  }, [isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Please enter a title");
    if (!body.trim()) return toast.error("Please enter a message body");
    if (target === "specific" && !selectedTech) {
      return toast.error("Please select a technician");
    }

    try {
      setSending(true);

      const res = await fetch("/api/admin/send-custom-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          techId: target === "specific" ? selectedTech : undefined,
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || "/tech/calls",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send notification");
      }

      // Play success sound
      try {
        const audio = new Audio("/forward.mp3");
        audio.play().catch(() => {});
      } catch {}

      toast.success(data.message || "Notification sent successfully!");
      setSuccessResult(data);

      setTimeout(() => {
        setBody("");
        setSuccessResult(null);
        onClose();
      }, 2000);

    } catch (err) {
      toast.error(err.message || "Error sending notification");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 280 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Top Gradient Banner */}
          <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md grid place-items-center text-xl shadow-inner">
                <FiBell />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Send Custom Notification</h3>
                <p className="text-xs text-blue-100 opacity-90">Instant FCM Push with App Icon</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition text-white text-base"
            >
              <FiX />
            </button>
          </div>

          {/* Modal Form */}
          <form onSubmit={handleSend} className="p-5 overflow-y-auto space-y-4 text-slate-800">
            {/* Target selection */}
            <div>
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2 block">
                Target Audience
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTarget("all")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-sm font-semibold transition ${
                    target === "all"
                      ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <FiUsers /> All Technicians
                </button>

                <button
                  type="button"
                  onClick={() => setTarget("specific")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-sm font-semibold transition ${
                    target === "specific"
                      ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <FiUser /> Single Technician
                </button>
              </div>
            </div>

            {/* Specific tech dropdown */}
            {target === "specific" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1"
              >
                <label className="text-xs font-semibold text-slate-600">Select Technician</label>
                <select
                  value={selectedTech}
                  onChange={(e) => setSelectedTech(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                >
                  <option value="">-- Choose a Technician --</option>
                  {techs.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.username || t.name} {t.phone ? `(${t.phone})` : ""}
                    </option>
                  ))}
                </select>
              </motion.div>
            )}

            {/* Quick Presets */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Quick Title Presets</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TITLES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTitle(preset)}
                    className="text-xs px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Notification Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter notification title..."
                className="input"
                required
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Message Content</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write the message that technicians will see in push banner..."
                rows={3}
                className="input resize-none"
                required
              />
            </div>

            {/* Target URL Destination */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <FiLink /> Tap Action Destination
              </label>
              <select
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="/tech/calls">Calls Page (/tech/calls)</option>
                <option value="/tech/payments">Payments Page (/tech/payments)</option>
                <option value="/tech">Service Form (/tech)</option>
                <option value="/tech/profile">Profile (/tech/profile)</option>
              </select>
            </div>

            {/* Live Preview Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Push Notification Preview</div>
              <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <img
                  src="/icons/icon-192x192.png"
                  alt="App Icon"
                  className="h-9 w-9 rounded-xl object-contain shadow-sm border border-slate-100"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {title || "Notification Title"}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-2">now</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                    {body || "Your message body will appear here..."}
                  </p>
                </div>
              </div>
            </div>

            {/* Success result message */}
            {successResult && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2 font-medium"
              >
                <FiCheckCircle className="text-emerald-600 text-base shrink-0" />
                <span>{successResult.message}</span>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={sending}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition flex items-center gap-2 disabled:opacity-60"
              >
                <FiSend />
                {sending ? "Sending Push..." : "Send Notification"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
