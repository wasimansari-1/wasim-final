"use client";

import { useEffect, useState, useMemo } from "react";
import Header from "../../components/Header";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaWhatsapp,
  FaPaperPlane,
  FaCopy,
  FaCheck,
  FaTrash,
  FaPlus,
  FaClock,
  FaMoneyBillWave,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaPhoneAlt,
  FaSyncAlt,
  FaShieldAlt,
  FaInfoCircle,
  FaBolt,
  FaPlayCircle,
  FaMoon,
  FaCalendarCheck,
} from "react-icons/fa";

const OFFICIAL_SENDER = "8700994288";
const MAX_RECIPIENTS = 4; // Strictly maximum 4 numbers

export default function WhatsAppReportsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingSingle, setSendingSingle] = useState(null);
  const [testingCron, setTestingCron] = useState(false);
  const [copied, setCopied] = useState(false);

  // Live IST Clock
  const [currentIST, setCurrentIST] = useState({ timeStr: "--:--:--", hm: "--:--", dateStr: "" });

  // Settings State
  const [recipients, setRecipients] = useState([]);
  const [newNumber, setNewNumber] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("20:00");
  const [autoSend, setAutoSend] = useState(true);
  const [masterTime, setMasterTime] = useState("20:00");

  // Live Stats & Preview
  const [stats, setStats] = useState(null);
  const [formattedMessage, setFormattedMessage] = useState("");
  const [logs, setLogs] = useState([]);

  // 1. Live Ticking IST Clock
  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      const utcTime = d.getTime() + d.getTimezoneOffset() * 60000;
      const istTime = new Date(utcTime + 330 * 60000);

      const hours = String(istTime.getHours()).padStart(2, "0");
      const minutes = String(istTime.getMinutes()).padStart(2, "0");
      const seconds = String(istTime.getSeconds()).padStart(2, "0");

      const timeStr = istTime.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      const dateStr = istTime.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      setCurrentIST({
        timeStr,
        hm: `${hours}:${minutes}`,
        dateStr,
        hours: istTime.getHours(),
        minutes: istTime.getMinutes(),
      });
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Auth & Initial Data Fetch
  useEffect(() => {
    (async () => {
      try {
        const authRes = await fetch("/api/auth/me");
        if (!authRes.ok) {
          window.location.href = "/login";
          return;
        }
        const me = await authRes.json();
        if (me.role !== "admin") {
          window.location.href = "/login";
          return;
        }
        setUser(me);
        await fetchSettingsAndStats();
      } catch (err) {
        console.error("Auth error:", err);
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchSettingsAndStats = async (showToast = false) => {
    try {
      const res = await fetch("/api/admin/whatsapp-report/get-settings", { cache: "no-store" });
      const data = await res.json();
      if (data.ok && data.settings) {
        const recList = Array.isArray(data.settings.recipients) ? data.settings.recipients : [];
        const normalized = recList.slice(0, MAX_RECIPIENTS).map((r, i) => {
          if (typeof r === "object" && r !== null) {
            return {
              phone: String(r.phone || "").replace(/[^0-9]/g, ""),
              label: r.label || `Recipient ${i + 1}`,
              time: r.time || data.settings.sendTime || "20:00",
              active: r.active !== false,
            };
          }
          return {
            phone: String(r || "").replace(/[^0-9]/g, ""),
            label: `Recipient ${i + 1}`,
            time: data.settings.sendTime || "20:00",
            active: true,
          };
        });

        setRecipients(normalized.length > 0 ? normalized : [{ phone: "8700994288", label: "Admin Wasim", time: "20:00", active: true }]);
        setAutoSend(data.settings.autoSend !== false);
        setMasterTime(data.settings.sendTime || "20:00");
        setStats(data.stats || null);
        setFormattedMessage(data.formattedMessage || "");
        setLogs(data.logs || []);

        if (showToast) toast.success("Live stats and settings updated! 🔄");
      }
    } catch (err) {
      console.error("Fetch settings error:", err);
      toast.error("Failed to load settings");
    }
  };

  // Immediate Auto-Persistence Helper
  const persistSettings = async (updatedRecipients, updatedAutoSend = autoSend, updatedMasterTime = masterTime) => {
    try {
      await fetch("/api/admin/whatsapp-report/save-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: updatedRecipients,
          autoSend: updatedAutoSend,
          sendTime: updatedMasterTime,
        }),
      });
    } catch (err) {
      console.error("Auto-persist error:", err);
    }
  };

  // 3. Helper to compute offset time string (+X minutes from now in IST)
  const getOffsetTime = (offsetMinutes = 1) => {
    const d = new Date();
    const utcTime = d.getTime() + d.getTimezoneOffset() * 60000;
    const istTime = new Date(utcTime + 330 * 60000 + offsetMinutes * 60000);

    const h = String(istTime.getHours()).padStart(2, "0");
    const m = String(istTime.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

  // 4. Quick Test (+1 Min Schedule for Master Time & All/Current)
  const handleQuickTestSchedule = async (offsetMinutes = 1) => {
    const targetTime = getOffsetTime(offsetMinutes);
    setMasterTime(targetTime);
    const updated = recipients.map((r) => ({ ...r, time: targetTime }));
    setRecipients(updated);
    setAutoSend(true);

    await persistSettings(updated, true, targetTime);
    toast.success(`⚡ Quick Test Scheduled for ${targetTime} IST (+${offsetMinutes} min)! Auto-Scheduler will send report automatically. ⏰`);
  };

  // 5. Quick Test for Individual Recipient (+1 Min)
  const handleQuickTestRecipient = async (phone, offsetMinutes = 1) => {
    const targetTime = getOffsetTime(offsetMinutes);
    const updated = recipients.map((r) =>
      r.phone === phone ? { ...r, time: targetTime, active: true } : r
    );
    setRecipients(updated);
    setAutoSend(true);
    await persistSettings(updated, true, masterTime);
    toast.success(`⚡ Recipient scheduled for ${targetTime} IST (+${offsetMinutes} min)! Auto-Scheduler is active.`);
  };

  // 6. 1-Click Set Daily Raat 8:00 PM Mode
  const handleSetDailyNightSchedule = async (time = "20:00") => {
    setMasterTime(time);
    const updated = recipients.map((r) => ({ ...r, time }));
    setRecipients(updated);
    setAutoSend(true);
    await persistSettings(updated, true, time);
    toast.success(`🌙 Daily Auto-Send Mode Active! Har roz raat ${time === "20:00" ? "8:00 PM" : time} IST par automatic report dispatch hogi. 🚀`);
  };

  // 7. Add Recipient (Max 4)
  const handleAddRecipient = async () => {
    const clean = newNumber.trim().replace(/[^0-9]/g, "");
    if (clean.length < 10) {
      return toast.error("Please enter a valid 10-digit mobile number");
    }
    if (recipients.length >= MAX_RECIPIENTS) {
      return toast.error(`Maximum ${MAX_RECIPIENTS} recipient numbers allowed.`);
    }
    if (recipients.some((r) => r.phone === clean)) {
      return toast.error("This mobile number is already in the recipient list");
    }

    const label = newLabel.trim() || `Recipient ${recipients.length + 1}`;
    const time = newTime || masterTime || "20:00";

    const nextRecipients = [
      ...recipients,
      { phone: clean, label, time, active: true },
    ];

    setRecipients(nextRecipients);
    setNewNumber("");
    setNewLabel("");

    await persistSettings(nextRecipients);
    toast.success(`Recipient "${label}" (+91 ${clean.slice(-10)}) saved permanently! 💾`);
  };

  // 8. Remove Recipient
  const handleRemoveRecipient = async (phoneToRemove) => {
    if (recipients.length <= 1) {
      return toast.error("At least 1 recipient number must remain.");
    }
    const nextRecipients = recipients.filter((r) => r.phone !== phoneToRemove);
    setRecipients(nextRecipients);
    await persistSettings(nextRecipients);
    toast.success("Recipient removed from database.");
  };

  // 9. Toggle Active Status
  const handleToggleRecipient = async (phone) => {
    const nextRecipients = recipients.map((r) =>
      r.phone === phone ? { ...r, active: !r.active } : r
    );
    setRecipients(nextRecipients);
    await persistSettings(nextRecipients);
  };

  // 10. Update Time for Individual Recipient
  const handleUpdateTime = async (phone, time) => {
    const nextRecipients = recipients.map((r) =>
      r.phone === phone ? { ...r, time } : r
    );
    setRecipients(nextRecipients);
    await persistSettings(nextRecipients);
  };

  // 11. Manual Save Settings Button
  const handleSaveSettings = async () => {
    if (recipients.length === 0) {
      return toast.error("Please add at least 1 recipient number");
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return toast.error(`Maximum ${MAX_RECIPIENTS} numbers allowed.`);
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/whatsapp-report/save-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients,
          autoSend,
          sendTime: masterTime,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("✅ WhatsApp Report Settings Saved Successfully!");
        await fetchSettingsAndStats();
      } else {
        toast.error(data.message || "Failed to save settings");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Network error while saving");
    } finally {
      setSaving(false);
    }
  };

  // 12. Send Live Report to ALL Configured Active Numbers
  const handleSendToAll = async () => {
    const activeList = recipients.filter((r) => r.active);
    if (activeList.length === 0) {
      return toast.error("No active recipient numbers found to send.");
    }

    if (!confirm(`Send today's live WhatsApp report to ${activeList.length} recipient(s) now?`)) {
      return;
    }

    setSendingAll(true);
    try {
      const res = await fetch("/api/admin/whatsapp-report/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendToAllConfigured: true }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`🚀 Report sent to ${activeList.length} number(s) successfully!`);
        await fetchSettingsAndStats();
      } else {
        toast.error(data.message || "Failed to send report");
      }
    } catch (err) {
      console.error("Send to all error:", err);
      toast.error("Error sending to all recipients");
    } finally {
      setSendingAll(false);
    }
  };

  // 13. Send to Single Recipient
  const handleSendSingle = async (rec) => {
    setSendingSingle(rec.phone);
    try {
      const res = await fetch("/api/admin/whatsapp-report/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: rec.phone, isTest: false }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`🚀 Report dispatched to ${rec.label} (${rec.phone})!`);
        await fetchSettingsAndStats();
      } else {
        toast.error(data.message || "Failed to send");
      }
    } catch (err) {
      toast.error("Error sending report");
    } finally {
      setSendingSingle(null);
    }
  };

  // 14. Test Force Cron Trigger
  const handleTriggerCronNow = async () => {
    setTestingCron(true);
    try {
      const res = await fetch("/api/admin/whatsapp-report/cron?force=true");
      const data = await res.json();
      if (data.ok) {
        toast.success(`⚡ Scheduler triggered! Dispatched: ${data.count || 0} report(s).`);
        await fetchSettingsAndStats();
      } else {
        toast.error(data.error || "Scheduler check failed");
      }
    } catch (err) {
      toast.error("Error triggering cron");
    } finally {
      setTestingCron(false);
    }
  };

  // 15. Copy Message Text
  const handleCopy = () => {
    if (!formattedMessage) return;
    navigator.clipboard.writeText(formattedMessage);
    setCopied(true);
    toast.success("WhatsApp message copied to clipboard! 📋");
    setTimeout(() => setCopied(false), 2000);
  };

  const activeCount = recipients.filter((r) => r.active).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-green-600 to-emerald-700 text-white grid place-items-center shadow-md">
              <FaWhatsapp size={26} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                WhatsApp Daily Reports & Dispatch Scheduler
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                <span>Template: <b className="text-emerald-700 font-mono">thank_you</b></span>
                <span>•</span>
                <span>Max 4 Numbers</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Auto-Scheduler Active (Runs every 20s)
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => fetchSettingsAndStats(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition active:scale-95 cursor-pointer"
            >
              <FaSyncAlt className="text-xs" />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-md hover:bg-emerald-700 active:scale-95 transition disabled:opacity-60 cursor-pointer"
            >
              <FaCheck className="text-xs" />
              <span>{saving ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>
        </div>

        {/* 🌟 System Live Clock & Auto-Scheduler Status Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-md border border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 grid place-items-center text-xl flex-shrink-0">
              <FaClock />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Live Indian Standard Time (IST)</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white mt-0.5">
                {currentIST.timeStr} <span className="text-xs font-sans font-semibold text-slate-300">({currentIST.dateStr})</span>
              </div>
            </div>
          </div>

          {/* Quick Schedule Test Action Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="text-xs text-slate-300 font-medium mr-1 hidden lg:block">
              🧪 Quick Testing:
            </div>

            <button
              type="button"
              onClick={() => handleQuickTestSchedule(1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-md transition active:scale-95 cursor-pointer"
              title="Set Auto-Send schedule for 1 minute from now to test automatic dispatch"
            >
              <FaBolt />
              <span>Test in +1 Min ({getOffsetTime(1)})</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickTestSchedule(5)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
              title="Set Auto-Send schedule for 5 minutes from now"
            >
              <span>+5 Min ({getOffsetTime(5)})</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerCronNow}
              disabled={testingCron}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-60 cursor-pointer"
              title="Force trigger the scheduler right now to dispatch reports immediately"
            >
              <FaPlayCircle />
              <span>{testingCron ? "Triggering..." : "Force Trigger Now"}</span>
            </button>
          </div>
        </div>

        {/* 🌙 DEDICATED SECTION: Daily Raat 8:00 PM Automatic Report Dispatch */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-indigo-500/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-800/60">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-400 grid place-items-center text-xl flex-shrink-0">
                <FaMoon />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white tracking-tight">
                    Daily Raat 8:00 PM Automatic WhatsApp Report Dispatch
                  </h2>
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                    Daily Scheduled
                  </span>
                </div>
                <p className="text-xs text-indigo-200/80 mt-0.5">
                  Is option ko enable karke aap daily raat 8:00 baje (ya apna manchaha time) set kar sakte hain. System apne aap har roz report send kar dega.
                </p>
              </div>
            </div>

            {/* Enable/Disable Daily Switch */}
            <div className="flex items-center gap-3 self-end sm:self-center bg-indigo-900/40 px-4 py-2 rounded-2xl border border-indigo-500/30">
              <span className="text-xs font-bold text-indigo-200">
                {autoSend ? "Daily Auto-Send: ON" : "Daily Auto-Send: OFF"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSend}
                  onChange={(e) => {
                    setAutoSend(e.target.checked);
                    persistSettings(recipients, e.target.checked, masterTime);
                    toast.success(e.target.checked ? "✅ Daily Auto-Send Mode Enabled!" : "⚠️ Daily Auto-Send Disabled (Manual Only)");
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>

          {/* Quick Night Preset Buttons & Time Picker */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-4 bg-slate-900/60 p-3.5 rounded-2xl border border-indigo-500/20 space-y-1.5">
              <label className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider block">
                Scheduled Daily Time (IST)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={masterTime}
                  onChange={(e) => {
                    setMasterTime(e.target.value);
                    const updated = recipients.map((r) => ({ ...r, time: e.target.value }));
                    setRecipients(updated);
                    persistSettings(updated, autoSend, e.target.value);
                  }}
                  className="input bg-indigo-950/80 text-white font-extrabold text-base border-indigo-500/40 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => handleSetDailyNightSchedule("20:00")}
                  className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md flex-shrink-0 transition active:scale-95 cursor-pointer"
                >
                  Set 8:00 PM
                </button>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-2">
              <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                1-Click Night Schedule Presets (Roz Raat Bhejne Ke Liye)
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "🌙 8:00 PM (Default)", time: "20:00" },
                  { label: "🌙 8:30 PM", time: "20:30" },
                  { label: "🌙 9:00 PM", time: "21:00" },
                  { label: "🌙 9:30 PM", time: "21:30" },
                  { label: "🌙 10:00 PM", time: "22:00" },
                ].map((preset) => (
                  <button
                    key={preset.time}
                    type="button"
                    onClick={() => handleSetDailyNightSchedule(preset.time)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      masterTime === preset.time && autoSend
                        ? "bg-emerald-500 text-slate-950 font-black shadow-lg ring-2 ring-emerald-400"
                        : "bg-indigo-900/50 hover:bg-indigo-800/70 text-indigo-100 border border-indigo-500/30"
                    }`}
                  >
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Status Ribbon */}
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3 text-xs text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FaCalendarCheck className="text-emerald-400 text-sm flex-shrink-0" />
              <span>
                <b>Status:</b> {autoSend ? `Daily Auto-Send Active — Roz raat ${masterTime} IST par automatic report send hogi.` : "Daily Auto-Send Disabled — Manual trigger only."}
              </span>
            </div>
            <div className="font-mono text-[11px] text-emerald-300 bg-emerald-900/60 px-2.5 py-1 rounded-lg self-start sm:self-auto border border-emerald-500/30">
              Target: {activeCount} Number(s)
            </div>
          </div>
        </div>

        {/* 🌟 Live Today's Snapshot KPI Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={<FaMoneyBillWave />}
              label="Today's Revenue"
              value={`₹${(stats.totalRevenue || 0).toLocaleString("en-IN")}`}
              subtext={`Cash: ₹${(stats.totalCash || 0).toLocaleString("en-IN")} • Online: ₹${(stats.totalOnline || 0).toLocaleString("en-IN")}`}
              color="bg-emerald-600"
            />
            <StatCard
              icon={<FaCheckCircle />}
              label="Closed Calls Today"
              value={`${stats.totalClosedToday || 0} calls`}
              subtext="Completed jobs today"
              color="bg-blue-600"
            />
            <StatCard
              icon={<FaHourglassHalf />}
              label="Pending Calls"
              value={`${stats.totalPendingCalls || 0} calls`}
              subtext="In process"
              color="bg-amber-600"
            />
            <StatCard
              icon={<FaWhatsapp />}
              label="Recipient Slots"
              value={`${recipients.length} / ${MAX_RECIPIENTS} Used`}
              subtext={`${activeCount} active for dispatch`}
              color="bg-emerald-700"
            />
          </div>
        )}

        {/* Main Grid: Recipient Manager & Live Message Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ================= LEFT: Recipient & Time Configuration (7 Cols) ================= */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Recipient Phone Numbers (Max 4 Slots) */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <FaPhoneAlt className="text-emerald-600" />
                    <span>Configured Recipients ({recipients.length} of {MAX_RECIPIENTS} Max)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Har number ka apna specific time bhi set kiya ja sakta hai ya default {masterTime} par send hoga.
                  </p>
                </div>

                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    recipients.length >= MAX_RECIPIENTS
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {recipients.length >= MAX_RECIPIENTS
                    ? `Full (${MAX_RECIPIENTS}/${MAX_RECIPIENTS})`
                    : `${recipients.length}/${MAX_RECIPIENTS} Slots Used`}
                </span>
              </div>

              {/* Add Recipient Form */}
              {recipients.length < MAX_RECIPIENTS ? (
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    ➕ Add Recipient Slot ({recipients.length + 1} of {MAX_RECIPIENTS})
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                        Mobile Number (10 Digits)
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={newNumber}
                        onChange={(e) => setNewNumber(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="e.g. 9876543210"
                        className="input bg-white text-xs py-2 px-3"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                        Recipient Label / Name
                      </label>
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="e.g. Owner Wasim, Manager"
                        className="input bg-white text-xs py-2 px-3"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                        Send Time (IST)
                      </label>
                      <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="input bg-white text-xs py-2 px-3"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Quick Time:</span>
                      <button
                        type="button"
                        onClick={() => setNewTime(getOffsetTime(1))}
                        className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-[11px] font-bold text-slate-700 cursor-pointer"
                      >
                        +1 Min ({getOffsetTime(1)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTime(masterTime)}
                        className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-[11px] font-bold text-slate-700 cursor-pointer"
                      >
                        Default ({masterTime})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddRecipient}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <FaPlus />
                      <span>Add & Save</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3 text-xs flex items-center gap-2">
                  <FaInfoCircle className="flex-shrink-0 text-amber-600" />
                  <span>Maximum 4 recipient numbers reached. Ek sath 4 number ko hi report bheja ja sakta hai. Naya number add karne ke liye pehle kisi ek ko remove karein.</span>
                </div>
              )}

              {/* Recipient Cards List */}
              <div className="space-y-2.5 pt-1">
                {recipients.map((rec, index) => {
                  const cleanPhone = rec.phone.startsWith("91") ? rec.phone : "91" + rec.phone;
                  const waChatLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formattedMessage)}`;
                  const isDueNow = rec.time === currentIST.hm;

                  return (
                    <div
                      key={rec.phone}
                      className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isDueNow && rec.active
                          ? "bg-amber-50/80 border-amber-300 shadow-md ring-2 ring-amber-400"
                          : rec.active
                          ? "bg-white border-slate-200 shadow-sm"
                          : "bg-slate-50/70 border-slate-200 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 font-extrabold grid place-items-center flex-shrink-0 text-sm shadow-inner">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{rec.label}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                rec.active
                                  ? isDueNow
                                    ? "bg-amber-500 text-white animate-pulse"
                                    : "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {rec.active ? (isDueNow ? "⏰ Due Now!" : "Active") : "Paused"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-2 mt-0.5">
                            <span>📱 +91 {rec.phone.slice(-10)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-700 font-bold">
                              <FaClock size={10} className="text-slate-400" /> {rec.time || masterTime} IST
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                        {/* Quick +1 Min for this recipient */}
                        <button
                          type="button"
                          onClick={() => handleQuickTestRecipient(rec.phone, 1)}
                          title="Set time to current time + 1 minute to test automatic dispatch for this number"
                          className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-extrabold cursor-pointer transition active:scale-95"
                        >
                          +1m Test
                        </button>

                        {/* Time Picker */}
                        <input
                          type="time"
                          value={rec.time || masterTime}
                          onChange={(e) => handleUpdateTime(rec.phone, e.target.value)}
                          title="Change schedule time for this number"
                          className="input bg-slate-50 text-xs py-1 px-2 w-24 border-slate-200 font-semibold"
                        />

                        {/* Instant Direct Send Button */}
                        <button
                          type="button"
                          onClick={() => handleSendSingle(rec)}
                          disabled={sendingSingle === rec.phone}
                          title={`Send instant report to ${rec.label} (+91 ${rec.phone.slice(-10)})`}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
                        >
                          <FaPaperPlane size={11} />
                          <span>{sendingSingle === rec.phone ? "..." : "Send"}</span>
                        </button>

                        {/* Direct WA Web Full Report Link */}
                        <a
                          href={waChatLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open 100% Full Unbroken Report in WhatsApp"
                          className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition active:scale-95 cursor-pointer"
                        >
                          <FaWhatsapp size={14} />
                        </a>

                        {/* Active Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleRecipient(rec.phone)}
                          title={rec.active ? "Pause Auto-Send for this number" : "Resume Auto-Send"}
                          className={`px-2.5 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                            rec.active
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {rec.active ? "Pause" : "Enable"}
                        </button>

                        {/* Delete */}
                        {recipients.length > 1 && (
                          <button
                            onClick={() => handleRemoveRecipient(rec.phone)}
                            title="Remove recipient permanently"
                            className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition active:scale-95 cursor-pointer"
                          >
                            <FaTrash size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Instant 1-Click Multi-Send Action Banner */}
            <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-800 rounded-3xl p-5 sm:p-6 text-white shadow-lg space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                    <span>🚀 Instant Multi-Number Dispatch</span>
                  </h3>
                  <p className="text-xs text-emerald-100 opacity-90 mt-0.5">
                    Template <b className="text-amber-300 font-mono">thank_you</b> ke sath sabhi {activeCount} number(s) ko instant message send karein.
                  </p>
                </div>

                <button
                  onClick={handleSendToAll}
                  disabled={sendingAll || activeCount === 0}
                  className="px-5 py-3 rounded-2xl bg-white text-emerald-800 font-extrabold text-sm shadow-md hover:bg-emerald-50 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  <FaPaperPlane />
                  <span>{sendingAll ? "Dispatching..." : `Send to All (${activeCount} Numbers)`}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ================= RIGHT: WhatsApp Message Live Preview & Audit Logs (5 Cols) ================= */}
          <div className="lg:col-span-5 space-y-5">
            {/* Live Message Bubble Preview */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FaWhatsapp className="text-emerald-500 text-lg" />
                  <h3 className="font-extrabold text-base text-slate-900">Live WhatsApp Message Preview</h3>
                </div>

                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <FaCheck className="text-emerald-600" /> : <FaCopy />}
                  <span>{copied ? "Copied" : "Copy Text"}</span>
                </button>
              </div>

              {/* Chat Bubble Container */}
              <div className="bg-[#EFEAE2] rounded-2xl p-4 sm:p-5 border border-[#e0dad0] shadow-inner relative">
                <div className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-md text-xs sm:text-sm text-slate-800 leading-relaxed font-sans space-y-2 border border-slate-100">
                  <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-slate-900">
                    {formattedMessage || "Generating daily aggregated report preview..."}
                  </pre>
                  <div className="text-right text-[10px] text-slate-400 font-mono">
                    {masterTime} • ✓✓
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 text-center">
                This exact live report is pushed to WhatsApp numbers configured on the left.
              </div>
            </div>

            {/* Recent Dispatch History Log */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <FaClock className="text-slate-400" />
                  <span>Recent Dispatch Audit Logs</span>
                </h3>
                <span className="text-[11px] text-slate-400">{logs.length} logged</span>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No dispatch logs recorded yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div
                      key={log._id}
                      className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          📱 +91 {log.phone?.slice(-10)} {log.label ? `(${log.label})` : ""}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })} • {log.type}
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === "sent"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {log.status === "sent" ? "Delivered ✓" : "Failed ✕"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, subtext, color }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
      <div className={`h-11 w-11 rounded-xl ${color} text-white grid place-items-center shadow-sm text-lg flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-slate-500 uppercase truncate">{label}</div>
        <div className="font-extrabold text-base sm:text-lg text-slate-900 truncate">{value}</div>
        {subtext && <div className="text-[10px] text-slate-400 truncate">{subtext}</div>}
      </div>
    </div>
  );
}
