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
} from "react-icons/fa";
import { FiExternalLink } from "react-icons/fi";

const OFFICIAL_SENDER = "8700994288";
const MAX_RECIPIENTS = 4; // Strictly maximum 4 numbers

export default function WhatsAppReportsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingSingle, setSendingSingle] = useState(null);
  const [copied, setCopied] = useState(false);

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

  // 1. Auth & Initial Data Fetch
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

  // Immediate Auto-Persistence Helper (Jab tak delete na karein tab tak rahega)
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

  // 2. Add Recipient (Strictly Max 4 Numbers with Auto-Save)
  const handleAddRecipient = async () => {
    const clean = newNumber.trim().replace(/[^0-9]/g, "");
    if (clean.length < 10) {
      return toast.error("Please enter a valid 10-digit mobile number");
    }
    if (recipients.length >= MAX_RECIPIENTS) {
      return toast.error(`Maximum ${MAX_RECIPIENTS} recipient numbers allowed. Ek sath maximum 4 number hi add kiye ja sakte hain.`);
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

  // 3. Remove Recipient with Auto-Save
  const handleRemoveRecipient = async (phoneToRemove) => {
    if (recipients.length <= 1) {
      return toast.error("At least 1 recipient number must remain.");
    }
    const nextRecipients = recipients.filter((r) => r.phone !== phoneToRemove);
    setRecipients(nextRecipients);
    await persistSettings(nextRecipients);
    toast.success("Recipient removed from database.");
  };

  // 4. Toggle Active Status with Auto-Save
  const handleToggleRecipient = async (phone) => {
    const nextRecipients = recipients.map((r) =>
      r.phone === phone ? { ...r, active: !r.active } : r
    );
    setRecipients(nextRecipients);
    await persistSettings(nextRecipients);
  };

  // 5. Update Time for Individual Recipient with Auto-Save
  const handleUpdateTime = async (phone, time) => {
    const nextRecipients = recipients.map((r) =>
      r.phone === phone ? { ...r, time } : r
    );
    setRecipients(nextRecipients);
    await persistSettings(nextRecipients);
  };

  // 6. Manual Save Settings Button
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

  // 7. Send Live Report to ALL Configured Active Numbers (Up to 4)
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

  // 8. Send to Single Recipient
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

  // 9. Copy Message Text
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
              <p className="text-xs sm:text-sm text-slate-500">
                Template: <b className="text-emerald-700 font-mono">thank_you</b> • Max 4 Recipient Numbers • Auto-Saved in Database
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
                    Numbers are permanently saved. Jab tak aap delete nahi karenge, ye database me secure rahenge.
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
                        Send Time
                      </label>
                      <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="input bg-white text-xs py-2 px-3"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddRecipient}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <FaPlus />
                      <span>Add & Save Permanently</span>
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

                  return (
                    <div
                      key={rec.phone}
                      className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        rec.active
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
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {rec.active ? "Active" : "Paused"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                            <span>📱 +91 {rec.phone.slice(-10)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-600">
                              <FaClock size={10} className="text-slate-400" /> {rec.time || masterTime}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        {/* Time Picker */}
                        <input
                          type="time"
                          value={rec.time || masterTime}
                          onChange={(e) => handleUpdateTime(rec.phone, e.target.value)}
                          title="Change schedule time for this number"
                          className="input bg-slate-50 text-xs py-1 px-2 w-24 border-slate-200 font-semibold"
                        />

                        {/* Instant Direct Send Button (No redirection) */}
                        <button
                          type="button"
                          onClick={() => handleSendSingle(rec)}
                          disabled={sendingSingle === rec.phone}
                          title={`Send instant report to ${rec.label} (+91 ${rec.phone.slice(-10)})`}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
                        >
                          <FaPaperPlane size={12} />
                          <span>{sendingSingle === rec.phone ? "Sending..." : "Send Report"}</span>
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

            {/* 2. Global Automated Schedule Settings */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <FaClock className="text-blue-600" />
                    <span>Daily Automatic Dispatch Schedule</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    System har roz is time par configured numbers ko automatic WhatsApp daily report send karega.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSend}
                    onChange={(e) => {
                      setAutoSend(e.target.checked);
                      persistSettings(recipients, e.target.checked, masterTime);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Default Auto-Send Time (IST)
                  </label>
                  <input
                    type="time"
                    value={masterTime}
                    onChange={(e) => {
                      setMasterTime(e.target.value);
                      persistSettings(recipients, autoSend, e.target.value);
                    }}
                    className="input bg-slate-50 text-sm font-bold border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Quick Preset Times
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["20:00", "20:30", "21:00", "21:30", "22:00"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setMasterTime(t);
                          const updated = recipients.map((r) => ({ ...r, time: t }));
                          setRecipients(updated);
                          persistSettings(updated, autoSend, t);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          masterTime === t
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaShieldAlt className="text-blue-600 flex-shrink-0 text-sm" />
                  <span>
                    Status: <b>{autoSend ? `Enabled (Scheduled at ${masterTime} IST Daily)` : "Disabled (Manual Only)"}</b>
                  </span>
                </div>
                <span className="font-semibold text-blue-700">{activeCount} recipient(s) active</span>
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
