"use client";

import Header from "../../components/Header";
import { useEffect, useState, useRef, useCallback } from "react";
import { FiSearch, FiDownload, FiX, FiPhone, FiMapPin, FiCheckCircle, FiClock, FiUsers, FiExternalLink } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const statusColors = {
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold",
  Closed: "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold",
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  "In Process": "bg-blue-100 text-blue-800 border-blue-200",
  Canceled: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function ForwardedList() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const [viewItem, setViewItem] = useState(null);

  const observer = useRef(null);
  const debounceRef = useRef(null);

  const load = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);

      try {
        const currentPage = reset ? 1 : page;
        const params = new URLSearchParams({ page: String(currentPage), q, status });
        const r = await fetch("/api/admin/forwarded?" + params.toString());
        const d = await r.json();

        const newItems = d.items || [];
        if (reset) {
          setItems(newItems);
          setPage(1);
        } else {
          setItems((prev) => [...prev, ...newItems]);
        }

        setHasMore(Boolean(d.hasMore));
      } catch (err) {
        console.error(err);
      } finally {
        setInitialLoad(false);
        setLoading(false);
      }
    },
    [page, q, status, loading]
  );

  const lastItemRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            setPage((p) => p + 1);
          }
        },
        { threshold: 1 }
      );

      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load(true);
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [q, status]);

  useEffect(() => {
    if (page === 1) return;
    load(false);
  }, [page]);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        const u = await me.json();
        if (u.role !== "admin") {
          window.location.href = "/login";
          return;
        }
        setUser(u);
        load(true);
      } catch {
        window.location.href = "/login";
      }
    })();
  }, []);

  const downloadAll = async () => {
    try {
      const r = await fetch("/api/admin/forwarded-all");
      const d = await r.json();

      const header = ["Sr No", "Client", "Phone", "Address", "Service Type", "Technician", "Status", "Price", "Date", "Closed Date"];
      const rows = d.map((x, idx) => [
        x.srNo || (d.length - idx),
        x.clientName,
        x.phone,
        x.address,
        x.type,
        x.techName,
        x.status,
        x.price || 0,
        new Date(x.createdAt).toLocaleString("en-IN"),
        x.closedAt ? new Date(x.closedAt).toLocaleString("en-IN") : "",
      ]);

      const csv = [header, ...rows]
        .map((row) => row.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white grid place-items-center shadow-md">
              <FiUsers size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                All Customers
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Comprehensive directory of client history, service jobs, and closure records.
              </p>
            </div>
          </div>

          <button
            onClick={downloadAll}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-95 shadow-sm"
          >
            <FiDownload size={16} /> Export All CSV
          </button>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap gap-3 items-center"
        >
          <div className="relative flex-1 min-w-[200px]">
            <FiSearch className="absolute left-3 top-3.5 text-slate-400" size={16} />
            <input
              className="input pl-9"
              placeholder="Search by client name, phone, address, technician..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <select
            className="input bg-white w-full sm:w-48"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Closed">Closed Calls</option>
            <option value="Pending">Pending</option>
            <option value="In Process">In Process</option>
            <option value="Completed">Completed</option>
            <option value="Canceled">Canceled</option>
          </select>
        </motion.div>

        {/* Customer Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100/80 text-slate-700 text-left border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3 w-16 text-center">Sr. No</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Service</th>
                  <th className="p-3">Technician</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Closure / Date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {items.map((it, i) => {
                  const isLast = i === items.length - 1;
                  const isClosed = it.status === "Closed" || it.status === "Completed";
                  const closedTime = it.closedAt || (isClosed ? it.updatedAt : null);

                  return (
                    <tr
                      key={it._id}
                      ref={isLast ? lastItemRef : null}
                      onClick={() => setViewItem(it)}
                      className="hover:bg-blue-50/50 transition cursor-pointer"
                    >
                      <td className="p-3 text-center">
                        <span className="h-6 w-6 rounded-lg bg-slate-100 font-bold text-slate-700 text-xs inline-grid place-items-center border border-slate-200">
                          {it.srNo ?? (i + 1)}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{it.clientName}</td>
                      <td className="p-3 text-slate-600 font-medium">{it.phone}</td>
                      <td className="p-3 text-slate-600">{it.type || "—"}</td>
                      <td className="p-3 text-blue-700 font-medium">{it.techName || "—"}</td>

                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            statusColors[it.status] || "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {it.status}
                        </span>
                      </td>

                      <td className="p-3 text-slate-500 text-xs">
                        {isClosed && closedTime ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <FiCheckCircle size={12} /> {new Date(closedTime).toLocaleString("en-IN")}
                          </span>
                        ) : (
                          new Date(it.createdAt).toLocaleString("en-IN")
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {initialLoad && (
            <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading customers…</div>
          )}

          {!initialLoad && items.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-sm">No customer records found.</div>
          )}

          {loading && !initialLoad && (
            <div className="p-4 text-center text-slate-400 text-xs">Loading more…</div>
          )}
        </div>
      </main>

      {/* Customer Details Modal */}
      <AnimatePresence>
        {viewItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              className="relative bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 border border-slate-100"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-blue-600 text-white grid place-items-center font-bold text-sm">
                    {(viewItem.clientName || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{viewItem.clientName}</h2>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span>Customer Details</span>
                      <span className="px-2 py-0.2 bg-blue-100 text-blue-800 rounded-md font-bold text-[10px]">
                        Sr #{viewItem.srNo || (items.findIndex((x) => x._id === viewItem._id) + 1)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setViewItem(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Phone Number</span>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <FiPhone className="text-blue-600" />
                    <a href={`tel:${viewItem.phone}`} className="hover:underline">{viewItem.phone}</a>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Service Price</span>
                  <div className="font-extrabold text-slate-900 text-sm">₹{viewItem.price || 0}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1 sm:col-span-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Address</span>
                  <div className="flex items-start gap-1 font-medium">
                    <FiMapPin className="text-slate-400 shrink-0 mt-0.5" />
                    <span>{viewItem.address || "—"}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Assigned Technician</span>
                  <div className="font-bold text-blue-700">{viewItem.techName || "—"}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Status</span>
                  <div>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${statusColors[viewItem.status] || "bg-slate-200"}`}>
                      {viewItem.status}
                    </span>
                  </div>
                </div>

                {viewItem.closedAt && (
                  <div className="p-3 bg-emerald-50 rounded-xl space-y-1 sm:col-span-2 border border-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-700">Closure Details</span>
                    <div className="font-semibold text-emerald-900">
                      Closed on {new Date(viewItem.closedAt).toLocaleString("en-IN")} {viewItem.closedByName ? `by ${viewItem.closedByName}` : ""}
                    </div>
                  </div>
                )}

                {viewItem.notes && (
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1 sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Notes</span>
                    <p className="text-slate-600">{viewItem.notes}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setViewItem(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition"
              >
                Close Window
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
