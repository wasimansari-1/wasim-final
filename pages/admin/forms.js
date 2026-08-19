"use client";

import Header from "../../components/Header";
import { useEffect, useState } from "react";
import { saveAs } from "../../utils/csv";
import { FiSearch, FiFilter, FiDownload, FiFileText, FiX, FiCheckCircle } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="p-3">
          <div className="h-5 bg-slate-200 rounded-lg w-full"></div>
        </td>
      ))}
    </tr>
  );
}

const statusBadges = {
  "Services Done": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Installation Done": "bg-blue-100 text-blue-800 border-blue-200",
  "Complaint Done": "bg-purple-100 text-purple-800 border-purple-200",
  "Under Process": "bg-amber-100 text-amber-800 border-amber-200",
};

export default function AdminForms() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [tech, setTech] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null);

  const load = async (p = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        q,
        status,
        tech,
        dateFrom,
        dateTo,
        page: p,
      });
      const res = await fetch(`/api/admin/forms?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Error fetching:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me", { cache: "no-store" });
      if (!me.ok) return (window.location.href = "/login");
      const u = await me.json();
      if (u.role !== "admin") return (window.location.href = "/login");
      setUser(u);
      await load();
    })();
  }, []);

  const handleDebounce = (setter) => (e) => {
    const val = e.target.value;
    setter(val);
    clearTimeout(typingTimeout);
    setTypingTimeout(setTimeout(() => load(1), 350));
  };

  const exportCSV = async () => {
    const params = new URLSearchParams({
      q,
      status,
      tech,
      dateFrom,
      dateTo,
      csv: "1",
    });
    const res = await fetch(`/api/admin/forms?${params.toString()}`);
    const d = await res.json();
    saveAs("service_forms.csv", d.csv);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white grid place-items-center shadow-md">
              <FiFileText size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Customer Service Forms
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Submitted customer signatures, sticker photos, and service receipts.
              </p>
            </div>
          </div>

          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition active:scale-95"
          >
            <FiDownload /> Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="label">Search Client / Phone</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-3 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Client name / phone / address"
                value={q}
                onChange={handleDebounce(setQ)}
              />
            </div>
          </div>

          <div>
            <label className="label">Service Status</label>
            <select
              className="input bg-white"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                load(1);
              }}
            >
              <option value="">All Status</option>
              <option>Services Done</option>
              <option>Installation Done</option>
              <option>Complaint Done</option>
              <option>Under Process</option>
            </select>
          </div>

          <div>
            <label className="label">Technician</label>
            <input
              className="input"
              placeholder="Username"
              value={tech}
              onChange={handleDebounce(setTech)}
            />
          </div>

          <div>
            <label className="label">From Date</label>
            <input
              className="input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="label">To Date</label>
            <input
              className="input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div className="md:col-span-6 flex justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setPage(1);
                load(1);
              }}
              className="btn bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-6"
            >
              Apply Filter
            </button>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100/80 text-slate-700 text-left border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">Technician</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Address</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Signature</th>
                  <th className="p-3">Sticker</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                ) : items.length > 0 ? (
                  items.map((it) => (
                    <tr key={it._id} className="hover:bg-blue-50/50 transition">
                      <td className="p-3 font-semibold text-blue-700">{it.techUsername}</td>
                      <td className="p-3 font-medium text-slate-900">{it.clientName}</td>
                      <td className="p-3 text-slate-600">{it.phone}</td>
                      <td className="p-3 text-slate-600 max-w-[200px] truncate">{it.address}</td>
                      <td className="p-3 font-bold text-slate-900">₹{it.payment || 0}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadges[it.status] || "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                        >
                          {it.status}
                        </span>
                      </td>

                      {/* Signature */}
                      <td className="p-3">
                        {it.signature ? (
                          <img
                            src={it.signature}
                            alt="Signature"
                            onClick={() => setPreviewMedia({ type: "Signature", url: it.signature, title: `Signature - ${it.clientName}` })}
                            className="h-9 w-16 object-contain bg-white rounded-lg border border-slate-200 hover:scale-110 transition cursor-pointer shadow-sm"
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Sticker Photo */}
                      <td className="p-3">
                        {it.stickerUrl ? (
                          <img
                            src={it.stickerUrl}
                            alt="Sticker"
                            onClick={() => setPreviewMedia({ type: "Sticker", url: it.stickerUrl, title: `Sticker - ${it.clientName}` })}
                            className="h-9 w-9 object-cover rounded-lg border border-slate-200 hover:scale-110 transition cursor-pointer shadow-sm"
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="p-3 text-slate-500 text-xs">
                        {new Date(it.createdAt).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="text-center text-slate-400 py-12 text-sm">
                      No service forms found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && items.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-slate-50/70 border-t border-slate-100 text-sm">
              <button
                disabled={page <= 1}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  load(p);
                }}
                className="px-4 py-1.5 rounded-xl bg-white border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-50 transition"
              >
                ← Prev
              </button>

              <div className="text-xs font-semibold text-slate-600">
                Page <span className="text-slate-900 font-bold">{page}</span> • Total {total} records
              </div>

              <button
                disabled={items.length < 20}
                onClick={() => {
                  const p = page + 1;
                  setPage(p);
                  load(p);
                }}
                className="px-4 py-1.5 rounded-xl bg-white border border-slate-200 font-semibold hover:bg-slate-50 transition"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Lightbox Media Preview Modal */}
      <AnimatePresence>
        {previewMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-3"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">{previewMedia.title}</h3>
                <button onClick={() => setPreviewMedia(null)} className="text-slate-400 hover:text-slate-700 text-lg">
                  <FiX />
                </button>
              </div>

              <div className="flex items-center justify-center bg-slate-50 rounded-2xl p-4 min-h-[220px]">
                <img
                  src={previewMedia.url}
                  alt={previewMedia.title}
                  className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setPreviewMedia(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
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
