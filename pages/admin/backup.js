"use client";

import { useEffect, useState, useRef } from "react";
import Header from "../../components/Header";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaDatabase,
  FaDownload,
  FaUpload,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSyncAlt,
  FaCalendarAlt,
  FaPhoneAlt,
  FaMoneyBillWave,
  FaFileAlt,
  FaUsers,
  FaShieldAlt,
  FaInfoCircle,
  FaFileCode,
  FaLayerGroup,
} from "react-icons/fa";
import { FiX, FiCheck, FiAlertOctagon } from "react-icons/fi";

export default function AdminBackupPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Export State
  const [exportRange, setExportRange] = useState("all"); // "all" or "custom"
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [downloading, setDownloading] = useState(false);

  // Import State
  const fileInputRef = useRef(null);
  const [uploadedBackup, setUploadedBackup] = useState(null);
  const [importMode, setImportMode] = useState("upsert"); // "upsert" or "overwrite"
  const [importing, setImporting] = useState(false);
  const [restoreConfirmModal, setRestoreConfirmModal] = useState(false);

  // 1. Auth & Initial Stats Load
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          window.location.href = "/login";
          return;
        }
        const me = await res.json();
        if (me.role !== "admin") {
          window.location.href = "/login";
          return;
        }
        setUser(me);
        await fetchStats();
      } catch (err) {
        console.error("Auth error:", err);
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchStats = async (showToast = false) => {
    try {
      const res = await fetch("/api/admin/backup/stats", { cache: "no-store" });
      const data = await res.json();
      if (data.ok && data.stats) {
        setStats(data.stats);
        if (showToast) toast.success("Database stats refreshed");
      }
    } catch (err) {
      console.error("Fetch stats error:", err);
    }
  };

  // 2. Export / Download Backup File
  const handleDownloadBackup = () => {
    setDownloading(true);
    const params = new URLSearchParams({
      range: exportRange,
      download: "1",
    });

    if (exportRange === "custom") {
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
    }

    const downloadUrl = `/api/admin/backup/export?${params.toString()}`;

    // Create temporary link to trigger download
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `chimney_solutions_backup_${exportRange}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(false);
      toast.success("Database Backup Download Started ✓");
    }, 800);
  };

  // 3. Handle File Upload Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast.error("Please upload a valid .json backup file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed || !parsed.data || typeof parsed.data !== "object") {
          throw new Error("Invalid backup file schema");
        }

        setUploadedBackup(parsed);
        toast.success(`Backup file loaded: ${parsed.totalRecords || 0} records detected`);
      } catch (err) {
        console.error("JSON parse error:", err);
        toast.error("Failed to parse JSON file. Ensure it is a valid Chimney Solutions backup.");
      }
    };
    reader.readAsText(file);
  };

  // 4. Perform Restore / Import
  const handleExecuteRestore = async () => {
    if (!uploadedBackup) return;

    try {
      setImporting(true);
      const res = await fetch("/api/admin/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupPayload: uploadedBackup,
          mode: importMode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Restore failed");

      toast.success(data.message || "Database Restored Successfully! ✓");
      setRestoreConfirmModal(false);
      setUploadedBackup(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchStats();
    } catch (err) {
      toast.error(err.message || "Failed to restore database");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans antialiased text-slate-800 pb-16">
      <Header user={user} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Executive Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 relative z-10">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                <FaDatabase size={12} /> MongoDB Enterprise Backup
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
                Disaster Recovery
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Database Backup & Restore Manager
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Export complete snapshots of your MongoDB database or restore past backups in one click. All calls, payments, service forms, and technician records are safely archived.
            </p>
          </div>

          <button
            onClick={() => fetchStats(true)}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/15 transition shadow-sm self-start md:self-auto"
          >
            <FaSyncAlt size={12} /> Refresh Stats
          </button>
        </div>

        {/* Live Database Overview Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* 1. Total Documents */}
            <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-3xl p-4 shadow-sm space-y-1 col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200 flex items-center gap-1">
                <FaLayerGroup size={11} className="text-emerald-400" /> Total Documents
              </div>
              <div className="text-2xl font-black text-white">{stats.totalRecords?.toLocaleString("en-IN") || 0}</div>
              <div className="text-[10px] text-blue-200/80 font-medium">Across all collections</div>
            </div>

            {/* 2. Forwarded Calls */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <FaPhoneAlt size={10} className="text-blue-600" /> Service Calls
              </div>
              <div className="text-xl font-extrabold text-slate-900">{stats.forwarded_calls?.toLocaleString("en-IN") || 0}</div>
              <div className="text-[10px] text-slate-400">Customer calls</div>
            </div>

            {/* 3. Payments */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <FaMoneyBillWave size={10} className="text-emerald-600" /> Payment Records
              </div>
              <div className="text-xl font-extrabold text-slate-900">{stats.payments?.toLocaleString("en-IN") || 0}</div>
              <div className="text-[10px] text-slate-400">Cash & online ledger</div>
            </div>

            {/* 4. Service Forms */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <FaFileAlt size={10} className="text-purple-600" /> Service Forms
              </div>
              <div className="text-xl font-extrabold text-slate-900">{stats.service_forms?.toLocaleString("en-IN") || 0}</div>
              <div className="text-[10px] text-slate-400">With digital signatures</div>
            </div>

            {/* 5. Technicians & Users */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <FaUsers size={10} className="text-amber-600" /> Accounts & Techs
              </div>
              <div className="text-xl font-extrabold text-slate-900">{(stats.technicians + stats.users)?.toLocaleString("en-IN") || 0}</div>
              <div className="text-[10px] text-slate-400">Active accounts</div>
            </div>
          </div>
        )}

        {/* Main 2-Column Grid: Export vs Import */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* 1. EXPORT / BACKUP CARD */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-2xl bg-blue-50 text-blue-600 grid place-items-center text-base">
                  <FaDownload />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">1. Export Database Backup</h3>
                  <p className="text-xs text-slate-400">Download complete snapshot as JSON</p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                Export Ready
              </span>
            </div>

            {/* Range Selection Radio Pills */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Select Backup Scope / Timeframe:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExportRange("all")}
                  className={`p-3 rounded-2xl border text-xs font-bold transition text-left flex flex-col gap-1 ${
                    exportRange === "all"
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <FaDatabase size={11} /> All Time Data
                  </span>
                  <span className="text-[10px] opacity-80 font-normal">Complete database archive</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportRange("custom")}
                  className={`p-3 rounded-2xl border text-xs font-bold transition text-left flex flex-col gap-1 ${
                    exportRange === "custom"
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <FaCalendarAlt size={11} /> Custom Date Range
                  </span>
                  <span className="text-[10px] opacity-80 font-normal">Filter by specific dates</span>
                </button>
              </div>
            </div>

            {/* Custom Date Range Pickers (if custom selected) */}
            {exportRange === "custom" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs"
              >
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Start Date (From):</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">End Date (To):</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </motion.div>
            )}

            {/* Included Collections Summary Box */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="font-bold text-slate-900 text-[11px] uppercase flex items-center gap-1.5">
                <FaCheckCircle className="text-emerald-600" /> Collections Included in Export:
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {["forwarded_calls", "payments", "service_forms", "technicians", "users", "whatsapp_report_settings"].map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[10px] font-semibold text-slate-700">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Download Button */}
            <div className="pt-2">
              <button
                disabled={downloading}
                onClick={handleDownloadBackup}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-60"
              >
                <FaDownload size={13} />
                {downloading ? "Preparing Backup..." : "Download Full Backup File (.json)"}
              </button>
            </div>
          </div>

          {/* 2. IMPORT / RESTORE CARD */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center text-base">
                  <FaUpload />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">2. Restore Database from Backup</h3>
                  <p className="text-xs text-slate-400">Import and restore previous backup files</p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                Restore Engine
              </span>
            </div>

            {/* File Upload Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-3xl p-6 text-center cursor-pointer transition bg-slate-50/60 hover:bg-blue-50/20 space-y-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="h-10 w-10 rounded-2xl bg-blue-100 text-blue-600 grid place-items-center mx-auto text-lg">
                <FaFileCode />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-xs sm:text-sm">
                  {uploadedBackup ? "Backup File Selected" : "Click to Upload Backup File"}
                </div>
                <p className="text-[11px] text-slate-400">Accepts .json backup files generated by Chimney Solutions</p>
              </div>
            </div>

            {/* Uploaded File Details Preview */}
            {uploadedBackup && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-200/60 pb-2">
                  <span className="flex items-center gap-1.5">
                    <FaCheckCircle className="text-emerald-600" /> Backup Ready to Restore
                  </span>
                  <span>{uploadedBackup.totalRecords || 0} Total Records</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-950 pt-1">
                  <div><b>Generated:</b> {new Date(uploadedBackup.generatedAt || Date.now()).toLocaleString("en-IN")}</div>
                  <div><b>App:</b> {uploadedBackup.app || "Chimney Solutions"}</div>
                </div>

                {uploadedBackup.recordCounts && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {Object.entries(uploadedBackup.recordCounts).map(([key, count]) => (
                      <span key={key} className="px-2 py-0.5 rounded-md bg-white text-emerald-800 text-[10px] font-bold border border-emerald-200">
                        {key}: {count}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Restore Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Select Restore Mode:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode("upsert")}
                  className={`p-3 rounded-2xl border text-xs font-bold transition text-left flex flex-col gap-0.5 ${
                    importMode === "upsert"
                      ? "bg-emerald-700 text-white border-emerald-700 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <FaShieldAlt size={11} /> Safe Merge (Recommended)
                  </span>
                  <span className="text-[10px] opacity-80 font-normal">Updates existing & inserts missing</span>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode("overwrite")}
                  className={`p-3 rounded-2xl border text-xs font-bold transition text-left flex flex-col gap-0.5 ${
                    importMode === "overwrite"
                      ? "bg-rose-700 text-white border-rose-700 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <FaExclamationTriangle size={11} /> Clean Overwrite
                  </span>
                  <span className="text-[10px] opacity-80 font-normal">Wipes & replaces with backup snapshot</span>
                </button>
              </div>
            </div>

            {/* Restore Action Button */}
            <div className="pt-2">
              <button
                disabled={!uploadedBackup || importing}
                onClick={() => setRestoreConfirmModal(true)}
                className="w-full py-3.5 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold text-xs sm:text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                <FaUpload size={13} />
                {importing ? "Restoring Database..." : "Restore Database from Selected File"}
              </button>
            </div>
          </div>
        </div>

        {/* Safety & Instructions Accordion */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-3 text-xs text-slate-600">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <FaInfoCircle className="text-blue-600" /> Database Backup & Safety Tips:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 text-[11px] text-slate-500">
            <div className="p-3 bg-slate-50 rounded-2xl space-y-1 border border-slate-100">
              <div className="font-bold text-slate-800">1. Regular Weekly Backups</div>
              <p>Download a full database backup file weekly and store it safely on your Google Drive or computer.</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl space-y-1 border border-slate-100">
              <div className="font-bold text-slate-800">2. Safe Merge Restore</div>
              <p>Safe Merge mode ensures no existing customer records or technician logins are deleted during restoration.</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl space-y-1 border border-slate-100">
              <div className="font-bold text-slate-800">3. Full Compatibility</div>
              <p>The exported JSON contains full data integrity with MongoDB ObjectIds and timestamp mappings.</p>
            </div>
          </div>
        </div>
      </main>

      {/* ⚠️ RESTORE CONFIRMATION MODAL */}
      <AnimatePresence>
        {restoreConfirmModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setRestoreConfirmModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-600 grid place-items-center text-lg">
                  <FiAlertOctagon />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Confirm Database Restore</h3>
                  <p className="text-xs text-slate-400">Please review before proceeding</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 space-y-1 text-amber-950">
                  <div className="font-bold flex items-center gap-1.5">
                    <FaExclamationTriangle className="text-amber-600" />
                    Mode: {importMode === "overwrite" ? "Clean Overwrite (Full Reset)" : "Safe Merge / Upsert"}
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    You are about to restore <b>{uploadedBackup?.totalRecords || 0} records</b> into MongoDB.
                    {importMode === "overwrite"
                      ? " Warning: Existing collections will be wiped and replaced with the backup snapshot."
                      : " Existing records will be updated and missing records will be inserted safely."}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-[11px]">
                  <div><b>Backup Date:</b> {new Date(uploadedBackup?.generatedAt || Date.now()).toLocaleString("en-IN")}</div>
                  <div><b>Generated By:</b> {uploadedBackup?.generatedBy || "admin"}</div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <button
                  disabled={importing}
                  onClick={handleExecuteRestore}
                  className={`w-full py-3 active:scale-95 text-white font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 shadow-md ${
                    importMode === "overwrite"
                      ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                  }`}
                >
                  <FaCheckCircle size={13} />
                  {importing ? "Executing Restoration..." : "Yes, Restore Database Now"}
                </button>

                <button
                  type="button"
                  onClick={() => setRestoreConfirmModal(false)}
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
