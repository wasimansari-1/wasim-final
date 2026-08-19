'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Header from '../../components/Header';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers,
  FiUser,
  FiFilter,
  FiCalendar,
  FiRefreshCw,
  FiPhoneCall,
  FiDollarSign,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiPhone,
  FiSearch,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
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
    return '';
  }
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function TechnicianCallsPage() {
  const [user, setUser] = useState(null);
  const [techs, setTechs] = useState([]);
  const [calls, setCalls] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedTech, setSelectedTech] = useState('all');
  const [statusTab, setStatusTab] = useState('Closed');
  const [viewMode, setViewMode] = useState('closed_log'); // 'overview' | 'closed_log'
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          setUser(null);
          window.location.href = '/login';
          return;
        }
        const me = await res.json();
        if (me.role !== 'admin') {
          setUser(null);
          window.location.href = '/login';
          return;
        }
        setUser(me);
      } catch (e) {
        setUser(null);
      }
    })();
  }, []);

  const buildQS = useCallback(() => {
    const p = new URLSearchParams();
    if (month) p.set('month', month);
    if (selectedTech && selectedTech !== 'all') p.set('techId', selectedTech);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    return p.toString();
  }, [month, selectedTech, dateFrom, dateTo]);

  const load = useCallback(
    async ({ notify = false } = {}) => {
      if (!user) return;
      try {
        setRefreshing(true);
        if (loading) setLoading(true);

        const qs = buildQS();
        const res = await fetch(`/api/admin/technician-calls?${qs}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load stats');

        const techsNorm = (data.technicians || []).map((t) => ({
          ...t,
          monthAmount: safeNum(t.monthAmount || 0),
          monthSubmitted: safeNum(t.monthSubmitted || 0),
          monthAmountByPrice: safeNum(t.monthAmountByPrice || 0),
          totalAmount: safeNum(t.totalAmount || 0),
          monthClosed: Number(t.monthClosed || 0),
          totalClosed: Number(t.totalClosed || 0),
        }));

        const callsNorm = (data.calls || []).map((c) => ({
          ...c,
          price: safeNum(c.price),
          submittedAmount: safeNum(c.submittedAmount),
          lastPaymentAt: c.lastPaymentAt || null,
        }));

        setTechs(techsNorm);
        setCalls(callsNorm);
        setSummary(data.summary || null);

        if (notify) toast.success('Data updated');
      } catch (err) {
        console.error('Load error', err);
        toast.error(err.message || 'Failed to load');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, buildQS, loading]
  );

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const counts = useMemo(
    () => ({
      Closed: calls.filter((c) => c.status === 'Closed' || c.status === 'Completed').length,
      Pending: calls.filter((c) => c.status === 'Pending').length,
      Canceled: calls.filter((c) => c.status === 'Canceled' || c.status === 'Cancelled').length,
    }),
    [calls]
  );

  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      const matchStatus =
        statusTab === 'Closed'
          ? (c.status === 'Closed' || c.status === 'Completed')
          : statusTab === 'Pending'
          ? c.status === 'Pending'
          : (c.status === 'Canceled' || c.status === 'Cancelled');

      const matchTech =
        selectedTech === 'all' || c.techId === selectedTech || c.technicianId === selectedTech;

      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        (c.clientName || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        (c.techName || '').toLowerCase().includes(q) ||
        (c.closedByName || '').toLowerCase().includes(q);

      return matchStatus && matchTech && matchQuery;
    });
  }, [calls, statusTab, selectedTech, query]);

  const totalPanelAmount = useMemo(() => {
    return filteredCalls.reduce((s, x) => s + safeNum(x.price), 0);
  }, [filteredCalls]);

  const totalCollectedAmount = useMemo(() => {
    return filteredCalls.reduce((s, x) => s + safeNum(x.submittedAmount), 0);
  }, [filteredCalls]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Top title & quick actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 text-white grid place-items-center shadow-md">
              <FiPhoneCall size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                Technician Calls & Closure Audit
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Track which technician closed which call and exact closure timestamps.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => load({ notify: true })}
              disabled={refreshing}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition"
            >
              <motion.span
                animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: 0.8, repeat: refreshing ? Infinity : 0 }}
              >
                <FiRefreshCw />
              </motion.span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <SmallCard
            icon={<FiCheckCircle />}
            label="Calls Closed (This Month)"
            value={summary ? summary.monthClosed : counts.Closed}
            color="bg-emerald-600"
          />
          <SmallCard
            icon={<FiUsers />}
            label="Lifetime Closed"
            value={summary ? summary.totalClosed : techs.reduce((s, t) => s + (t.totalClosed || 0), 0)}
            color="bg-indigo-600"
          />
          <SmallCard
            icon={<FiDollarSign />}
            label="Amount Collected"
            value={`₹${safeNum(summary?.monthAmount ?? techs.reduce((s,t)=>s + (t.monthAmount||t.monthSubmitted||0),0)).toFixed(0)}`}
            color="bg-blue-600"
          />
          <SmallCard
            icon={<FiClock />}
            label="Pending Calls"
            value={summary?.monthPending || counts.Pending}
            color="bg-amber-600"
          />
        </div>

        {/* Filters Panel */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Technician Filter</label>
              <select
                value={selectedTech}
                onChange={(e) => setSelectedTech(e.target.value)}
                className="input mt-1 bg-white"
              >
                <option value="all">All Technicians</option>
                {techs.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} {t.phone ? `(${t.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="input mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input mt-1"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => load({ notify: true })}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition active:scale-95 shadow-sm"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Search box */}
          <div className="relative pt-1">
            <FiSearch className="absolute left-3 top-4 text-slate-400 text-base" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by client name, phone number, address, technician..."
              className="input pl-9"
            />
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('closed_log')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                viewMode === 'closed_log'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FiCheckCircle /> Closed Calls Log ({counts.Closed})
            </button>

            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                viewMode === 'overview'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FiUsers /> Technician Overview ({techs.length})
            </button>
          </div>

          {viewMode === 'closed_log' && (
            <div className="flex items-center gap-1.5">
              {['Closed', 'Pending', 'Canceled'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusTab(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    statusTab === st
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st} ({counts[st] || 0})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* MAIN VIEW CONTENT */}
        {viewMode === 'overview' ? (
          /* Technician Cards Grid */
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base text-slate-900">All Technicians Performance</h2>
              <span className="text-xs text-slate-500">{techs.length} Technicians active</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-36 rounded-2xl skeleton-shimmer border border-slate-100" />
                  ))
                : techs.map((t) => (
                    <div
                      key={t._id}
                      onClick={() => {
                        setSelectedTech(t._id);
                        setViewMode('closed_log');
                        setStatusTab('Closed');
                      }}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition cursor-pointer flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold grid place-items-center flex-shrink-0 text-lg shadow-sm">
                          {t.avatar ? (
                            <img src={t.avatar} alt={t.name} className="h-full w-full object-cover rounded-2xl" />
                          ) : (
                            (t.name || '?')[0].toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 truncate">{t.name}</div>
                          <div className="text-xs text-slate-500 truncate">📱 {t.phone || '—'}</div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Month Closed</div>
                          <div className="font-extrabold text-emerald-600 text-sm">{t.monthClosed} calls</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Month Amount</div>
                          <div className="font-extrabold text-blue-600 text-sm">₹{t.monthAmount || t.monthSubmitted}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Total Closed</div>
                          <div className="font-semibold text-slate-700">{t.totalClosed} calls</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Total Amount</div>
                          <div className="font-semibold text-slate-700">₹{t.totalAmount}</div>
                        </div>
                      </div>

                      <button className="mt-3 w-full py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition">
                        View Closed Calls →
                      </button>
                    </div>
                  ))}
            </div>
          </div>
        ) : (
          /* Closed Calls Audit Log */
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-sm">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-base text-slate-900">
                  {statusTab === 'Closed' ? '✅ Call Closure History & Audit Trail' : `${statusTab} Calls`}
                </h2>
                <p className="text-xs text-slate-500">
                  Showing {filteredCalls.length} call(s) • Total Price: ₹{totalPanelAmount} • Collected: ₹{totalCollectedAmount}
                </p>
              </div>

              {selectedTech !== 'all' && (
                <button
                  onClick={() => setSelectedTech('all')}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Clear Tech Filter (Show All)
                </button>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-28 rounded-2xl skeleton-shimmer border border-slate-100" />
                ))}
              </div>
            ) : filteredCalls.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No {statusTab.toLowerCase()} calls found for the selected filters.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCalls.map((call) => {
                  const isClosed = call.status === 'Closed' || call.status === 'Completed';
                  const closedTimestamp = call.closedAt || call.updatedAt || call.createdAt;

                  return (
                    <motion.div
                      key={call._id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-2xl border transition shadow-sm hover:shadow-md ${
                        isClosed ? 'border-emerald-100 bg-emerald-50/20' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        {/* LEFT: Client & Service Details */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-base text-slate-900">
                              {call.clientName || call.customerName || 'Unknown Client'}
                            </span>

                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isClosed
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : call.status === 'Pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {call.status}
                            </span>

                            {call.type && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                                {call.type}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                            {call.phone && (
                              <span className="flex items-center gap-1 font-medium">
                                <FiPhone className="text-slate-400" /> {call.phone}
                              </span>
                            )}
                            {call.address && (
                              <span className="flex items-center gap-1">
                                <FiMapPin className="text-slate-400" /> {call.address}
                              </span>
                            )}
                          </div>

                          {/* 🌟 CRITICAL: Closure Timestamp & Technician Attribution */}
                          <div className="bg-white/80 border border-slate-200/80 rounded-xl p-2.5 mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-6 rounded-lg bg-blue-100 text-blue-700 grid place-items-center font-bold text-xs">
                                🔧
                              </span>
                              <span>
                                Assigned Technician: <b className="text-blue-700">{call.techName || call.closedByName || 'Technician'}</b>
                              </span>
                            </div>

                            {isClosed && (
                              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                <FiCheckCircle className="text-emerald-600" />
                                <span className="text-emerald-900 font-semibold">
                                  Closed: {fmtDate(closedTimestamp)}
                                </span>
                                <span className="text-[11px] text-emerald-700">
                                  ({timeAgo(closedTimestamp)})
                                </span>
                              </div>
                            )}

                            {!isClosed && call.createdAt && (
                              <div className="text-slate-400 text-xs">
                                Created: {fmtDate(call.createdAt)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* RIGHT: Financials & Action */}
                        <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                          <div className="text-right">
                            <div className="text-xs text-slate-400 font-bold uppercase">Price</div>
                            <div className="text-base font-extrabold text-slate-900">₹{call.price || 0}</div>
                            {call.submittedAmount > 0 && (
                              <div className="text-xs font-semibold text-emerald-600">
                                Paid: ₹{call.submittedAmount}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setExpanded(expanded === call._id ? null : call._id)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                          >
                            {expanded === call._id ? 'Hide Details' : 'View Audit'}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Audit Details */}
                      <AnimatePresence>
                        {expanded === call._id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-2 bg-white p-3 rounded-xl"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                              <div>
                                <b>Call ID:</b> <span className="font-mono text-slate-800">{call._id}</span>
                              </div>
                              <div>
                                <b>Created At:</b> {fmtDate(call.createdAt)}
                              </div>
                              {call.closedAt && (
                                <div>
                                  <b>Closed At:</b> {fmtDate(call.closedAt)} ({timeAgo(call.closedAt)})
                                </div>
                              )}
                              {call.closedByName && (
                                <div>
                                  <b>Closed By Tech:</b> <span className="text-blue-700 font-semibold">{call.closedByName}</span>
                                </div>
                              )}
                              {call.notes && (
                                <div className="sm:col-span-2">
                                  <b>Notes:</b> {call.notes}
                                </div>
                              )}
                            </div>

                            {/* Linked Payments */}
                            {call.matchedPayments && call.matchedPayments.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-100">
                                <div className="font-bold text-slate-700 mb-1">Matched Payments:</div>
                                {call.matchedPayments.map((mp, idx) => (
                                  <div key={idx} className="bg-slate-50 p-2 rounded-lg flex justify-between items-center mb-1 text-xs">
                                    <span>{fmtDate(mp.paymentCreatedAt)} • Mode: {mp.mode} • Receiver: {mp.receiver}</span>
                                    <span className="font-bold text-emerald-700">Online: ₹{mp.onlineAmount} + Cash: ₹{mp.cashAmount}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SmallCard({ icon, label, value, color }) {
  return (
    <motion.div whileHover={{ scale: 1.01 }} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
      <div className={`h-11 w-11 rounded-xl ${color} text-white grid place-items-center shadow-sm text-lg flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-slate-400 uppercase truncate">{label}</div>
        <div className="font-extrabold text-lg sm:text-xl text-slate-900 truncate">{value}</div>
      </div>
    </motion.div>
  );
}
