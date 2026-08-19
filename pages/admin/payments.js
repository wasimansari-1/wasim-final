"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Header from "../../components/Header";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function Payments() {
  const [user, setUser] = useState(null);

  const [techs, setTechs] = useState([]);
  const [techId, setTechId] = useState("");

  const [items, setItems] = useState([]);
  const [sum, setSum] = useState({ online: 0, cash: 0, total: 0 });

  const [range, setRange] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  const [viewItem, setViewItem] = useState(null);
  const [deleting, setDeleting] = useState(false); // <-- delete loading state

  // ---------------- HELPERS ----------------
  const formatDateTime = (d) => new Date(d).toLocaleString();
  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "-";

  const rangeLabel = useMemo(() => {
    switch (range) {
      case "today":
        return "Today";
      case "7":
        return "Last 7 Days";
      case "30":
        return "Last 30 Days";
      case "month":
        return "This Month";
      case "lastmonth":
        return "Last Month";
      case "year":
        return "This Year";
      case "all":
        return "All Time";
      case "custom":
        return `Custom${from ? ` from ${formatDate(from)}` : ""}${to ? ` to ${formatDate(to)}` : ""}`;
      default:
        return "Filter";
    }
  }, [range, from, to]);

  // ---------------- AUTH + TECH LIST (PARALLEL) ----------------
  useEffect(() => {
    (async () => {
      try {
        const [meRes, trRes] = await Promise.all([
          fetch("/api/auth/me").catch(() => null),
          fetch("/api/admin/techs").catch(() => null),
        ]);

        if (!meRes || !meRes.ok) {
          window.location.href = "/login";
          return;
        }

        const u = await meRes.json();
        if (!u || u.role !== "admin") {
          window.location.href = "/login";
          return;
        }
        setUser(u);

        if (trRes && trRes.ok) {
          const td = await trRes.json().catch(() => ({ items: [] }));
          setTechs(td.items || []);
        }
      } catch (err) {
        console.error(err);
        toast.error("Auth failed");
      }
    })();
  }, []);

  // ---------------- LOAD PAYMENT DATA ----------------
  async function load() {
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setLoading(true);

      const qs = new URLSearchParams({ techId, range, from, to });
      const r = await fetch("/api/admin/payments?" + qs.toString(), {
        signal: abortRef.current.signal,
      });
      const d = await r.json();

      setItems(d.items || []);
      setSum(d.sum || { online: 0, cash: 0, total: 0 });
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
        toast.error("Failed to load payments");
      }
    } finally {
      setLoading(false);
    }
  }

  // Auto load when admin ready
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ---------------- CSV EXPORT ----------------
  async function exportCSV() {
    try {
      const qs = new URLSearchParams({ techId, range, from, to, csv: "1" });
      const r = await fetch("/api/admin/payments?" + qs.toString());
      const d = await r.json();

      const blob = new Blob([d.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payment-report-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("CSV export failed");
    }
  }

  // ---------------- DELETE PAYMENT ----------------
  async function handleDeleteCurrentPayment() {
    if (!viewItem || !viewItem._id) {
      toast.error("No payment selected");
      return;
    }

    // Confirm with user
    const ok = window.confirm(
      "Are you sure you want to permanently delete this payment? This action cannot be undone."
    );
    if (!ok) return;

    setDeleting(true);
    try {
      // Try delete via DELETE endpoint. Adjust endpoint if your backend expects different path/query.
      const r = await fetch(`/api/admin/payments/${encodeURIComponent(viewItem._id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      let respBody = null;
      try {
        respBody = await r.json();
      } catch (e) {
        // ignore JSON parse error
      }

      if (!r.ok) {
        const msg = (respBody && respBody.error) || (respBody && respBody.message) || "Delete failed";
        throw new Error(msg);
      }

      // Optimistically update UI: remove from items and adjust sums
      setItems((prev) => prev.filter((it) => String(it._id) !== String(viewItem._id)));

      const online = Number(viewItem.onlineAmount || 0);
      const cash = Number(viewItem.cashAmount || 0);
      const total = online + cash;
      setSum((prev) => ({
        online: Math.max(0, Number(prev.online || 0) - online),
        cash: Math.max(0, Number(prev.cash || 0) - cash),
        total: Math.max(0, Number(prev.total || 0) - total),
      }));

      toast.success("Payment deleted");
      setViewItem(null);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  // Close modal on ESC
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && setViewItem(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  // ---------------- DERIVED STATS ----------------
  const totalPayments = items.length;
  const totalCalls = useMemo(
    () =>
      items.reduce((acc, p) => acc + (Array.isArray(p.calls) ? p.calls.length : 0), 0),
    [items]
  );

  return (
    <div className="bg-slate-50 min-h-screen">
      <Header user={user} />

      <main className="max-w-6xl mx-auto p-4 space-y-4">

        {/* ================= FILTER BAR ================= */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Payments Overview
              </div>
              <div className="text-sm sm:text-base font-semibold text-slate-900">
                {rangeLabel}
              </div>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500">
              Total Payments:{" "}
              <span className="font-semibold text-slate-800">{totalPayments}</span>
              {totalCalls > 0 && (
                <>
                  {" "}• Calls:{" "}
                  <span className="font-semibold text-slate-800">{totalCalls}</span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 sm:gap-3 text-xs sm:text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-500">Technician</span>
              <select
                className="border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white"
                value={techId}
                onChange={(e) => setTechId(e.target.value)}
              >
                <option value="">All Technicians</option>
                {techs.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-500">Date Range</span>
              <select
                className="border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="today">Today</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="month">This Month</option>
                <option value="lastmonth">Last Month</option>
                <option value="year">This Year</option>
                <option value="all">All Time</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {range === "custom" && (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-500">From</span>
                  <input
                    type="date"
                    className="border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-500">To</span>
                  <input
                    type="date"
                    className="border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex items-end gap-2 col-span-2 md:col-span-2 justify-end">
              <button
                onClick={load}
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Loading..." : "Apply Filter"}
              </button>

              <button
                onClick={exportCSV}
                className="hidden sm:inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-95 transition"
              >
                Export CSV
              </button>
            </div>

            {/* Mobile CSV button */}
            <button
              onClick={exportCSV}
              className="sm:hidden col-span-2 inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-95 transition"
            >
              Export CSV
            </button>
          </div>
        </section>

        {/* ================= SUMMARY CARDS ================= */}
        <section className="grid md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-1">
            <div className="text-xs text-slate-500">Online Collection</div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">
              ₹{sum.online}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-1">
            <div className="text-xs text-slate-500">Cash Collection</div>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
              ₹{sum.cash}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-1">
            <div className="text-xs text-slate-500">Total Collection</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">
              ₹{sum.total}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-1">
            <div className="text-xs text-slate-500">Payments / Calls</div>
            <div className="text-sm text-slate-800">
              <span className="font-semibold">{totalPayments}</span> payments
              {totalCalls > 0 && (
                <>
                  {" "}• <span className="font-semibold">{totalCalls}</span> calls
                </>
              )}
            </div>
          </div>
        </section>

        {/* ================= DESKTOP TABLE ================= */}
        <section className="hidden md:block bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100/80">
                <tr className="text-left text-slate-700">
                  <th className="p-3">Technician</th>
                  <th className="p-3">Paying Name</th>
                  <th className="p-3">Calls</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Online</th>
                  <th className="p-3">Cash</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">View</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>

              <tbody>
                {loading &&
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {Array.from({ length: 9 }).map((_, c) => (
                        <td key={c} className="p-3">
                          <div className="skeleton-shimmer h-4 w-full rounded-md" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-400">
                      No payments found for this filter.
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.map((p) => {
                    const online = Number(p.onlineAmount || 0);
                    const cash = Number(p.cashAmount || 0);
                    const total = online + cash;
                    const callCount = p.calls?.length || 0;
                    const callClients = (p.calls || [])
                      .map((c) => c.clientName)
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <tr
                        key={p._id}
                        className="border-t border-slate-100 hover:bg-blue-50/60 transition cursor-pointer"
                      >
                        <td className="p-3 text-slate-800">{p.techUsername}</td>
                        <td className="p-3 text-slate-800">{p.receiver}</td>

                        <td className="p-3">
                          <div className="font-medium text-slate-800">
                            {callCount} call{callCount !== 1 ? "s" : ""}
                          </div>
                          {callCount > 0 && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[260px]">
                              {callClients}
                            </div>
                          )}
                        </td>

                        <td className="p-3 text-slate-700">{p.mode}</td>
                        <td className="p-3 text-blue-600 font-medium">₹{online}</td>
                        <td className="p-3 text-emerald-600 font-medium">₹{cash}</td>
                        <td className="p-3 font-semibold text-slate-900">₹{total}</td>

                        <td className="p-3">
                          <button
                            onClick={() => setViewItem(p)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
                          >
                            View
                          </button>
                        </td>

                        <td className="p-3 text-slate-600">
                          {formatDateTime(p.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ================= MOBILE CARD LIST ================= */}
        <section className="space-y-3 md:hidden">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-shimmer h-28 rounded-2xl border border-slate-100" />
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-dashed border-slate-300 p-6 text-center text-slate-400 text-sm">
              No payments found for this filter.
            </div>
          )}

          {!loading &&
            items.map((p) => {
              const online = Number(p.onlineAmount || 0);
              const cash = Number(p.cashAmount || 0);
              const total = online + cash;
              const callCount = p.calls?.length || 0;

              return (
                <div
                  key={p._id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 space-y-2"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-xs text-slate-500">Technician</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {p.techUsername}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Total</div>
                      <div className="text-sm font-bold text-slate-900">
                        ₹{total}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-800">
                        {p.receiver}
                      </div>
                      <div>{p.mode}</div>
                      <div>{formatDateTime(p.createdAt)}</div>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <div>Online: <span className="font-semibold text-blue-600">₹{online}</span></div>
                      <div>Cash: <span className="font-semibold text-emerald-600">₹{cash}</span></div>
                      <div>
                        Calls:{" "}
                        <span className="font-semibold text-slate-800">
                          {callCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setViewItem(p)}
                    className="mt-2 w-full text-center text-xs font-semibold rounded-xl border border-slate-200 py-1.5 bg-slate-50 active:scale-95 transition"
                  >
                    View Call-wise Breakdown
                  </button>
                </div>
              );
            })}
        </section>
      </main>

      {/* ================= DETAILS MODAL ================= */}
      <AnimatePresence>
        {viewItem && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setViewItem(null)}
          >
            <motion.div
              className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col"
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 170, damping: 18 }}
            >
              {/* Modal Header */}
              <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Payment Details
                  </div>
                  <div className="text-base sm:text-lg font-semibold text-slate-900">
                    {viewItem.receiver} • {viewItem.techUsername}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {formatDateTime(viewItem.createdAt)} • Mode:{" "}
                    <span className="font-medium text-slate-800">
                      {viewItem.mode}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => setViewItem(null)}
                    className="rounded-full border border-slate-200 h-8 w-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 active:scale-95 transition"
                  >
                    ✕
                  </button>
                  <div className="hidden sm:flex flex-col items-end text-xs text-slate-600">
                    <span>
                      Online:{" "}
                      <span className="font-semibold text-blue-600">
                        ₹{viewItem.onlineAmount || 0}
                      </span>
                    </span>
                    <span>
                      Cash:{" "}
                      <span className="font-semibold text-emerald-600">
                        ₹{viewItem.cashAmount || 0}
                      </span>
                    </span>
                    <span>
                      Total:{" "}
                      <span className="font-semibold text-slate-900">
                        ₹
                        {Number(viewItem.onlineAmount || 0) +
                          Number(viewItem.cashAmount || 0)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-auto px-4 sm:px-6 py-4 space-y-4">
                {/* Summary strip (mobile visible) */}
                <div className="sm:hidden bg-slate-50 rounded-2xl border border-slate-100 px-3 py-2 text-[11px] flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Online:{" "}
                    <span className="font-semibold text-blue-600">
                      ₹{viewItem.onlineAmount || 0}
                    </span>
                  </span>
                  <span>
                    Cash:{" "}
                    <span className="font-semibold text-emerald-600">
                      ₹{viewItem.cashAmount || 0}
                    </span>
                  </span>
                  <span>
                    Total:{" "}
                    <span className="font-semibold text-slate-900">
                      ₹
                      {Number(viewItem.onlineAmount || 0) +
                        Number(viewItem.cashAmount || 0)}
                    </span>
                  </span>
                </div>

                {/* Payment Meta */}
                <div className="grid md:grid-cols-3 gap-3 text-xs sm:text-sm text-slate-700">
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3">
                    <div className="text-[11px] text-slate-500 mb-1">
                      Technician
                    </div>
                    <div className="font-semibold text-slate-900">
                      {viewItem.techUsername}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3">
                    <div className="text-[11px] text-slate-500 mb-1">
                      Paying Name
                    </div>
                    <div className="font-semibold text-slate-900">
                      {viewItem.receiver}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3">
                    <div className="text-[11px] text-slate-500 mb-1">
                      Calls Linked
                    </div>
                    <div className="font-semibold text-slate-900">
                      {viewItem.calls?.length || 0} call
                      {viewItem.calls?.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                {/* Call breakdown heading */}
                <div className="flex items-center justify-between mt-1">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                    Call-wise Breakdown
                  </h3>
                  <div className="text-[11px] text-slate-500">
                    Every call → price + online + cash clearly दिखेगा
                  </div>
                </div>

                {/* Call Breakdown Cards / Table */}
                {(!viewItem.calls || viewItem.calls.length === 0) && (
                  <div className="text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 px-3 py-2">
                    No call breakdown found for this payment.
                  </div>
                )}

                {viewItem.calls && viewItem.calls.length > 0 && (
                  <div className="space-y-2">
                    {/* Desktop: mini-table */}
                    <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100/80 text-slate-700">
                          <tr>
                            <th className="p-2 text-left">Client</th>
                            <th className="p-2 text-left">Phone</th>
                            <th className="p-2 text-left">Address</th>
                            <th className="p-2 text-left">Service</th>
                            <th className="p-2 text-right">Service Price</th>
                            <th className="p-2 text-right">Online</th>
                            <th className="p-2 text-right">Cash</th>
                            <th className="p-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewItem.calls.map((c, i) => {
                            const online = Number(c.onlineAmount || 0);
                            const cash = Number(c.cashAmount || 0);
                            const total = online + cash;
                            return (
                              <tr
                                key={i}
                                className="border-t border-slate-100 hover:bg-slate-50/80"
                              >
                                <td className="p-2 text-slate-900">
                                  {c.clientName || "-"}
                                </td>
                                <td className="p-2 text-slate-700">
                                  {c.phone || "-"}
                                </td>
                                <td className="p-2 text-slate-700 max-w-[220px] truncate">
                                  {c.address || "-"}
                                </td>
                                <td className="p-2 text-slate-700">
                                  {c.type || "-"}
                                </td>
                                <td className="p-2 text-right text-slate-800">
                                  ₹{c.price || 0}
                                </td>
                                <td className="p-2 text-right text-blue-600">
                                  ₹{online}
                                </td>
                                <td className="p-2 text-right text-emerald-600">
                                  ₹{cash}
                                </td>
                                <td className="p-2 text-right font-semibold text-slate-900">
                                  ₹{total}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile: stacked cards */}
                    <div className="sm:hidden space-y-2">
                      {viewItem.calls.map((c, i) => {
                        const online = Number(c.onlineAmount || 0);
                        const cash = Number(c.cashAmount || 0);
                        const total = online + cash;
                        return (
                          <div
                            key={i}
                            className="border border-slate-200 rounded-2xl bg-slate-50 p-3 text-[11px] space-y-1"
                          >
                            <div className="flex justify-between gap-2">
                              <div>
                                <div className="text-[10px] text-slate-500">
                                  Client
                                </div>
                                <div className="font-semibold text-slate-900">
                                  {c.clientName || "-"}
                                </div>
                                <div className="text-slate-600">
                                  {c.phone || "-"}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] text-slate-500">
                                  Service
                                </div>
                                <div className="font-medium text-slate-800">
                                  {c.type || "-"}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Service Price
                                </div>
                                <div className="font-semibold text-slate-900">
                                  ₹{c.price || 0}
                                </div>
                              </div>
                            </div>

                            <div className="text-slate-600">
                              <span className="text-[10px] text-slate-500">
                                Address:
                              </span>{" "}
                              {c.address || "-"}
                            </div>

                            <div className="flex justify-between items-center pt-1 border-t border-slate-200 mt-1">
                              <div className="space-y-0.5">
                                <div>
                                  Online:{" "}
                                  <span className="font-semibold text-blue-600">
                                    ₹{online}
                                  </span>
                                </div>
                                <div>
                                  Cash:{" "}
                                  <span className="font-semibold text-emerald-600">
                                    ₹{cash}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] text-slate-500">
                                  Total
                                </div>
                                <div className="text-sm font-bold text-slate-900">
                                  ₹{total}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-4 sm:px-6 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
                <div className="text-[11px] sm:text-xs text-slate-600">
                  Press <span className="font-mono">ESC</span> to close or click
                  outside the box.
                </div>

                <div className="flex items-center gap-2">
                  {/* Delete button (keeps design consistent but shows danger) */}
                  <button
                    onClick={handleDeleteCurrentPayment}
                    disabled={deleting}
                    className="inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold bg-red-600 text-white hover:bg-red-700 active:scale-95 transition disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Delete Payment"}
                  </button>

                  <button
                    onClick={() => setViewItem(null)}
                    className="inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold bg-slate-900 text-white hover:bg-black active:scale-95 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
