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

export default function WhatsAppReportsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Settings State
  const [recipients, setRecipients] = useState([]);
  const [newNumber, setNewNumber] = useState("");
  const [autoSend, setAutoSend] = useState(true);
  const [sendTime, setSendTime] = useState("20:00");

  // Live Stats & Preview
  const [stats, setStats] = useState(null);
  const [formattedMessage, setFormattedMessage] = useState("");
  const [logs, setLogs] = useState([]);

  // Test Send Modal State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("");

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
        setRecipients(recList);
        setAutoSend(data.settings.autoSend !== false);
        setSendTime(data.settings.sendTime || "20:00");
        setStats(data.stats || null);
        setFormattedMessage(data.formattedMessage || "");
        setLogs(data.logs || []);
        if (recList.length > 0 && !testPhone) {
          setTestPhone(recList[0]);
        }
        if (showToast) toast.success("Live Data Refreshed");
      }
    } catch (err) {
      console.error("Fetch settings error:", err);
      toast.error("Failed to load settings");
    }
  };

  // 2. Add Recipient (Max 3 Numbers)
  const handleAddRecipient = () => {
    const clean = newNumber.trim().replace(/[^0-9]/g, "");
    if (clean.length < 10) {
      return toast.error("Please enter a valid 10-digit mobile number");
    }
    if (recipients.length >= 3) {
      return toast.error("Maximum 3 recipient numbers allowed");
    }
    if (recipients.includes(clean)) {
      return toast.error("Number already in recipient list");
    }

    setRecipients((prev) => [...prev, clean]);
    if (!testPhone) setTestPhone(clean);
    setNewNumber("");
    toast.success("Recipient added. Click 'Save Settings' to apply.");
  };

  // 3. Remove Recipient
  const handleRemoveRecipient = (num) => {
    setRecipients((prev) => prev.filter((n) => n !== num));
  };

  // 4. Save Settings
  const handleSaveSettings = async () => {
    if (recipients.length === 0) {
      return toast.error("Please add at least 1 recipient phone number");
    }
    try {
      setSaving(true);
      const res = await fetch("/api/admin/whatsapp-report/save-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients,
          autoSend,
          sendTime,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Save failed");

      toast.success("WhatsApp Settings Saved Successfully ✓");
      await fetchSettingsAndStats();
    } catch (err) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // 5. Send Test Message Now
  const handleSendTestMessage = async (customPhone = null, sendAll = false) => {
    try {
      setSending(true);
      const targetPhone = customPhone || testPhone;

      if (!sendAll && !targetPhone) {
        return toast.error("Please enter or select a recipient number");
      }

      const res = await fetch("/api/admin/whatsapp-report/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: targetPhone,
          isTest: true,
          sendToAllConfigured: sendAll,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Send failed");

      toast.success(data.message || "Message Dispatched Successfully!");
      setTestModalOpen(false);
      await fetchSettingsAndStats();
    } catch (err) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // 6. Copy Formatted Message to Clipboard
  const handleCopyMessage = () => {
    if (!formattedMessage) return;
    navigator.clipboard.writeText(formattedMessage);
    toast.success("Message copied to clipboard ✓");
  };

  // 7. Open Direct in WhatsApp Web / App
  const openInWhatsApp = (targetPhone = null) => {
    const dest = targetPhone || (recipients[0] || OFFICIAL_SENDER);
    let clean = dest.replace(/[^0-9]/g, "");
    if (clean.length === 10) clean = "91" + clean;
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(formattedMessage)}`;
    window.open(url, "_blank");
  };

  const formatCurrency = (val) => "₹" + Number(val || 0).toLocaleString("en-IN");

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans antialiased text-slate-800 pb-16">
      <Header user={user} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Executive Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 relative z-10">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#25D366]/20 text-[#25D366] text-xs font-bold border border-[#25D366]/40 flex items-center gap-1.5 shadow-sm">
                <FaWhatsapp size={14} /> WhatsApp Automation
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
                Daily 8:00 PM Dispatch
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Automatic Daily Report Updates
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Every day at 8:00 PM, Chimney Solutions CRM automatically aggregates today's total payments (Cash vs Online), closed calls, pending calls, and canceled calls, and sends a complete executive update to your WhatsApp.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
            <button
              onClick={() => fetchSettingsAndStats(true)}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/15 transition shadow-sm"
            >
              <FaSyncAlt size={12} /> Refresh Data
            </button>

            <button
              onClick={() => setTestModalOpen(true)}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20bd5a] hover:to-[#0f7a6e] active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 transition"
            >
              <FaPaperPlane size={12} /> Send Test Message Now
            </button>
          </div>
        </div>

        {/* Top Metric Cards: Today's Live CRM Figures */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Total Revenue */}
            <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-3xl p-4 sm:p-5 shadow-sm space-y-1 relative overflow-hidden">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
                <FaMoneyBillWave size={12} className="text-emerald-400" /> Total Revenue Today
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">{formatCurrency(stats.totalRevenue)}</div>
              <div className="text-[11px] text-blue-200/80 font-medium">
                {stats.paymentsCount || 0} payment submissions
              </div>
            </div>

            {/* 2. Cash vs Online Breakdown */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment Breakdown</div>
              <div className="flex justify-between items-baseline gap-2 pt-0.5">
                <div>
                  <div className="text-[10px] font-semibold text-emerald-700">💵 Cash</div>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900">{formatCurrency(stats.totalCash)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold text-blue-700">💳 Online</div>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900">{formatCurrency(stats.totalOnline)}</div>
                </div>
              </div>
            </div>

            {/* 3. Closed Calls Today */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <FaCheckCircle size={11} className="text-emerald-600" /> Closed Calls Today
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600">{stats.totalClosedToday || 0}</div>
              <div className="text-[11px] text-slate-400 font-medium">Successfully completed</div>
            </div>

            {/* 4. Pending & Canceled Calls */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <FaHourglassHalf size={11} className="text-amber-500" /> Pending / Canceled
              </div>
              <div className="flex items-baseline gap-3 pt-0.5">
                <div>
                  <span className="text-xl font-black text-amber-600">{stats.totalPendingCalls || 0}</span>
                  <span className="text-[10px] text-slate-400 font-semibold ml-1">Pending</span>
                </div>
                <div>
                  <span className="text-xl font-black text-rose-500">{stats.totalCanceledToday || 0}</span>
                  <span className="text-[10px] text-slate-400 font-semibold ml-1">Canceled</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2-Column Main Section: Settings & Live Message Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Recipients Configuration (7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Sender Number & Automation Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center text-base">
                    <FaWhatsapp />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Sender & Schedule Setup</h3>
                    <p className="text-xs text-slate-400">Configure auto-dispatch parameters</p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Active
                </span>
              </div>

              {/* Sender Number Box */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <FaPhoneAlt size={9} /> Official Sender WhatsApp Number (From which messages are sent)
                </div>
                <div className="text-base font-extrabold text-slate-900 flex items-center justify-between">
                  <span>+91 {OFFICIAL_SENDER}</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-100/60 px-2.5 py-0.5 rounded-lg">
                    Official Sender
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  This is the registered WhatsApp API account. Messages are sent <b>FROM</b> this number <b>TO</b> the recipient numbers configured below.
                </p>
              </div>

              {/* Automatic 8:00 PM Toggle */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <FaClock size={12} className="text-blue-600" /> Daily 8:00 PM Automatic Dispatch
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Automatically generates and sends today's summary every night at 20:00 IST to all recipients below.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={autoSend}
                    onChange={(e) => setAutoSend(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Recipients List (Max 3 Numbers) */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Recipient WhatsApp Numbers</h4>
                    <p className="text-[11px] text-slate-400">
                      Add your personal mobile numbers to receive daily reports (Max 3 numbers)
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-100">
                    {recipients.length} / 3 Slots Used
                  </span>
                </div>

                {/* Recipient Cards */}
                {recipients.length === 0 ? (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="font-bold">No recipient numbers added yet!</div>
                    <p className="text-[11px] text-amber-800">
                      Add your personal mobile number below (e.g. your WhatsApp number) so the system knows where to deliver the 8:00 PM update.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recipients.map((num, idx) => (
                      <div
                        key={num}
                        className="p-3 bg-slate-50 hover:bg-slate-100/80 transition rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-slate-900 text-white font-black text-xs grid place-items-center">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                              <span>+91 {num}</span>
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                                Recipient #{idx + 1}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">Receives 8:00 PM Daily WhatsApp Report</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openInWhatsApp(num)}
                            title="Open WhatsApp chat with formatted report"
                            className="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition text-xs font-bold flex items-center gap-1"
                          >
                            <FaWhatsapp size={13} /> Chat
                          </button>

                          <button
                            onClick={() => handleRemoveRecipient(num)}
                            title="Remove recipient"
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                          >
                            <FaTrash size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Recipient Input (if less than 3) */}
                {recipients.length < 3 ? (
                  <div className="pt-2 flex items-center gap-2">
                    <div className="relative flex-1">
                      <FaPhoneAlt className="absolute left-3.5 top-3 text-slate-400 text-xs" />
                      <input
                        type="tel"
                        maxLength={10}
                        value={newNumber}
                        onChange={(e) => setNewNumber(e.target.value)}
                        placeholder="Enter 10-digit mobile number..."
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                      />
                    </div>
                    <button
                      onClick={handleAddRecipient}
                      className="px-4 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white text-xs font-bold rounded-2xl flex items-center gap-1.5 transition shadow-sm shrink-0"
                    >
                      <FaPlus size={10} /> Add Number
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-100 rounded-2xl text-xs text-slate-600 flex items-center gap-2">
                    <FaInfoCircle size={14} className="text-slate-500 shrink-0" />
                    <span>Maximum 3 recipient numbers limit reached. Remove a number to add a new one.</span>
                  </div>
                )}
              </div>

              {/* Save Settings Action */}
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  disabled={saving}
                  onClick={handleSaveSettings}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-md shadow-blue-500/20 transition disabled:opacity-60"
                >
                  <FaCheck size={12} />
                  {saving ? "Saving Changes..." : "Save Settings"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Message Preview Card (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#0b141a] text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 space-y-4 relative">
              {/* Preview Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#25D366] text-slate-950 font-black grid place-items-center text-sm">
                    CS
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>Chimney Solutions CRM</span>
                      <FaShieldAlt size={10} className="text-[#25D366]" />
                    </div>
                    <div className="text-[10px] text-slate-400">WhatsApp Preview • 08:00 PM</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopyMessage}
                    title="Copy Formatted Text"
                    className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition text-xs"
                  >
                    <FaCopy />
                  </button>

                  <button
                    onClick={() => openInWhatsApp()}
                    title="Open in WhatsApp Web"
                    className="p-2 text-[#25D366] hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition text-xs"
                  >
                    <FiExternalLink />
                  </button>
                </div>
              </div>

              {/* Realistic WhatsApp Chat Bubble */}
              <div className="bg-[#1f2c34] text-slate-100 p-4 rounded-2xl rounded-tl-sm text-xs font-mono whitespace-pre-wrap leading-relaxed border border-slate-700/50 shadow-inner">
                {formattedMessage || "Loading live preview..."}
                <div className="text-right text-[10px] text-slate-400 mt-2 font-sans flex items-center justify-end gap-1">
                  <span>08:00 PM</span>
                  <span className="text-blue-400">✓✓</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => setTestModalOpen(true)}
                  className="w-full py-3 bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20bd5a] hover:to-[#0f7a6e] active:scale-95 text-white font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20"
                >
                  <FaPaperPlane size={12} /> Send Live Test to WhatsApp
                </button>

                <button
                  onClick={() => openInWhatsApp()}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2"
                >
                  <FaWhatsapp size={14} className="text-[#25D366]" /> Open in WhatsApp Web Directly
                </button>
              </div>
            </div>

            {/* Quick Dispatch Info Box */}
            <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-2 text-xs text-slate-600">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <FaInfoCircle className="text-blue-600" /> Important Instructions:
              </div>
              <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-slate-500">
                <li>
                  <b>Sender:</b> <code className="text-slate-800 font-bold">8700994288</code> is your official business account.
                </li>
                <li>
                  <b>Recipients:</b> Add your personal WhatsApp mobile number(s) in the list above to receive notifications.
                </li>
                <li>
                  At 8:00 PM every night, CRM automatically dispatches today's full collection and calls report.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Section: Recent Dispatch Logs Table */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Recent Dispatch Logs</h3>
              <p className="text-xs text-slate-400">History of daily reports and test messages sent</p>
            </div>

            <button
              onClick={() => fetchSettingsAndStats()}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              <FaSyncAlt size={10} /> Refresh Logs
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No reports dispatched yet. Use "Send Test Message" above to test the system.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Recipient Number</th>
                    <th className="py-2.5 px-3">Dispatch Type</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {new Date(log.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        +91 {log.phone}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            log.type === "automated_cron_8pm"
                              ? "bg-blue-50 text-blue-700"
                              : log.type === "test"
                              ? "bg-purple-50 text-purple-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {log.type === "automated_cron_8pm" ? "8:00 PM Auto" : log.type === "test" ? "Test Send" : "Manual"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            log.status === "sent"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {log.status === "sent" ? "✓ Sent" : "✕ Failed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* 🚀 TEST SEND POPUP MODAL */}
      <AnimatePresence>
        {testModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setTestModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="h-10 w-10 rounded-2xl bg-[#25D366]/20 text-[#25D366] grid place-items-center text-lg">
                  <FaWhatsapp />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Send Instant Test WhatsApp</h3>
                  <p className="text-xs text-slate-400">Sent from official number +91 {OFFICIAL_SENDER}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Enter Recipient Mobile Number (To which message is sent):
                  </label>
                  <div className="relative">
                    <FaPhoneAlt className="absolute left-3.5 top-3 text-slate-400 text-xs" />
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="Enter 10-digit mobile number..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                {recipients.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Or select configured recipient:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {recipients.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setTestPhone(r)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                            testPhone === r
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          +91 {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <button
                  disabled={sending}
                  onClick={() => handleSendTestMessage(testPhone, false)}
                  className="w-full py-3 bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20bd5a] hover:to-[#0f7a6e] active:scale-95 text-white font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 shadow-md shadow-[#25D366]/20 disabled:opacity-60"
                >
                  <FaPaperPlane size={12} />
                  {sending ? "Dispatching Message..." : `Send Test to +91 ${testPhone || "Recipient"}`}
                </button>

                {recipients.length > 0 && (
                  <button
                    disabled={sending}
                    onClick={() => handleSendTestMessage(null, true)}
                    className="w-full py-2.5 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    Send to All {recipients.length} Configured Recipients
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="w-full py-2 text-slate-400 hover:text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
