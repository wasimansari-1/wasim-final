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
  FiAward,
  FiTrendingUp,
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
          monthIncentive: Number(t.monthClosed || 0) * 100, // ₹100 per closed call
          totalClosed: Number(t.totalClosed || 0),
          totalIncentive: Number(t.totalClosed || 0) * 100,
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

  // Quick Month Preset Handlers
  const handleSetThisMonth = () => {
    const n = new Date();
    setMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`);
    setDateFrom('');
    setDateTo('');
  };

  const handleSetLastMonth = () => {
    const n = new Date();
    n.setMonth(n.getMonth() - 1);
    setMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`);
    setDateFrom('');
    setDateTo('');
  };

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
        (c.customerName || '').toLowerCase().includes(q) ||
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

  const totalClosedIncentive = useMemo(() => {
    const closedCount = summary?.monthClosedCalls ?? counts.Closed;
    return closedCount * 100; // ₹100 per call
  }, [summary, counts]);

  const activeTechName = useMemo(() => {
    if (selectedTech === 'all') return 'All Technicians';
    const found = techs.find((t) => t._id === selectedTech);
    return found ? found.name : 'Selected Technician';
  }, [selectedTech, techs]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Top title & quick actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 text-white grid place-items-center shadow-md">
              <FiAward size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                Technician Closed Calls & ₹100 Incentive Audit
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Track which technician closed which call, exact closure timestamps, and calculate ₹100/call payout.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => load({ notify: true })}
              disabled={refreshing}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold shadow-sm hover:bg-slate-50 transition active:scale-95"
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

        {/* 🌟 Summary KPI Banner with ₹100/Call Incentive Payout */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <SmallCard
            icon={<FiCheckCircle />}
            label="Closed Calls (Month)"
            value={summary ? summary.monthClosedCalls : counts.Closed}
            subtext="Calls successfully finished"
            color="bg-emerald-600"
          />

          <SmallCard
            icon={<FiAward />}
            label="Incentive Payout (₹100/Call)"
            value={`₹${totalClosedIncentive.toLocaleString('en-IN')}`}
            subtext={`Rate: ₹100 × ${summary?.monthClosedCalls ?? counts.Closed} closed`}
            color="bg-amber-600"
            highlight={true}
          />

          <SmallCard
            icon={<FiDollarSign />}
            label="Payment Collected"
            value={`₹${safeNum(summary?.monthSubmittedTotal ?? techs.reduce((s,t)=>s + (t.monthAmount||t.monthSubmitted||0),0)).toLocaleString('en-IN')}`}
            subtext="Customer payment submitted"
            color="bg-blue-600"
          />

          <SmallCard
            icon={<FiUsers />}
            label="Active Technicians"
            value={techs.filter((t) => t.monthClosed > 0).length || techs.length}
            subtext={`${techs.length} total registered techs`}
            color="bg-indigo-600"
          />
        </div>

        {/* 📅 Filters & Date Range Selection */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <FiCalendar className="text-blue-600" />
              <span>Month & Date Filter</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSetThisMonth}
                className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 transition"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={handleSetLastMonth}
                className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 transition"
              >
                Last Month
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Technician</label>
              <select
                value={selectedTech}
                onChange={(e) => setSelectedTech(e.target.value)}
                className="input mt-1 bg-white"
              >
                <option value="all">All Technicians (Everyone)</option>
                {techs.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} • ({t.monthClosed} closed)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setDateFrom('');
                  setDateTo('');
                }}
                className="input mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Custom From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Custom To</label>
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
                Apply Filter
              </button>
            </div>
          </div>

          {/* Search box */}
          <div className="relative pt-1">
            <FiSearch className="absolute left-3 top-4 text-slate-400 text-base" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by client name, phone number, address, technician name, closed time..."
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
              <FiCheckCircle /> Closed Calls Audit Log ({counts.Closed})
            </button>

            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                viewMode === 'overview'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FiAward /> Technician Payouts & Commission ({techs.length})
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

        {/* ================= MAIN VIEW CONTENT ================= */}
        {viewMode === 'overview' ? (
          /* 🏆 Technician Incentive & Performance Cards */
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-bold text-base sm:text-lg text-slate-900">
                  Technician Monthly Closure & ₹100 Payout Ledger
                </h2>
                <p className="text-xs text-slate-500">
                  Showing monthly closed calls, ₹100 per call commission calculation, and payment volume for each technician.
                </p>
              </div>
              <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 font-semibold px-3 py-1.5 rounded-xl">
                Fixed Incentive: ₹100 / Closed Call
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-44 rounded-2xl skeleton-shimmer border border-slate-100" />
                  ))
                : techs.map((t) => {
                    const closedCalls = t.monthClosed || 0;
                    const incentiveAmount = closedCalls * 100;

                    return (
                      <div
                        key={t._id}
                        onClick={() => {
                          setSelectedTech(t._id);
                          setViewMode('closed_log');
                          setStatusTab('Closed');
                        }}
                        className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition cursor-pointer flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold grid place-items-center flex-shrink-0 text-lg shadow-sm">
                              {t.avatar ? (
                                <img src={t.avatar} alt={t.name} className="h-full w-full object-cover rounded-2xl" />
                              ) : (
                                (t.name || '?')[0].toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm text-slate-900 truncate group-hover:text-blue-600 transition">
                                {t.name}
                              </div>
                              <div className="text-xs text-slate-500 truncate">📱 {t.phone || '—'}</div>
                            </div>
                          </div>

                          {/* Incentive Highlight Box */}
                          <div className="mt-3 bg-gradient-to-r from-amber-50 via-emerald-50 to-emerald-50/50 border border-emerald-200/80 rounded-xl p-2.5 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] uppercase font-bold text-slate-500">
                                🎁 Month Incentive (₹100/Call)
                              </div>
                              <div className="text-base font-extrabold text-emerald-700">
                                ₹{incentiveAmount.toLocaleString('en-IN')}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                                {closedCalls} Closed
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Month Collected</div>
                            <div className="font-bold text-blue-600">₹{Number(t.monthAmount || t.monthSubmitted || 0).toLocaleString('en-IN')}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Lifetime Closed</div>
                            <div className="font-semibold text-slate-700">{t.totalClosed} calls (₹{(t.totalClosed * 100).toLocaleString('en-IN')})</div>
                          </div>
                        </div>

                        <button className="mt-3 w-full py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition flex items-center justify-center gap-1">
                          <span>View Closed Calls ({closedCalls})</span>
                          <span>→</span>
                        </button>
                      </div>
                    );
                  })}
            </div>
          </div>
        ) : (
          /* 📋 Closed Calls Audit Log with Exact Timestamps */
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-sm">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                  <span>{statusTab === 'Closed' ? '✅ Call Closure History & Exact Time Log' : `${statusTab} Calls`}</span>
                  <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                    {activeTechName}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filteredCalls.length} call(s) • Total Price: ₹{totalPanelAmount.toLocaleString('en-IN')} • Paid Collected: ₹{totalCollectedAmount.toLocaleString('en-IN')}
                </p>
              </div>

              {selectedTech !== 'all' && (
                <button
                  onClick={() => setSelectedTech('all')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition self-start sm:self-center"
                >
                  ✕ Clear Tech Filter (Show All)
                </button>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-32 rounded-2xl skeleton-shimmer border border-slate-100" />
                ))}
              </div>
            ) : filteredCalls.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No {statusTab.toLowerCase()} calls found for {activeTechName} in this date period.
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
                        isClosed ? 'border-emerald-200/80 bg-emerald-50/20' : 'border-slate-200 bg-white'
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

                            {isClosed && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <FiAward size={12} />
                                <span>+₹100 Incentive</span>
                              </span>
                            )}

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

                          {/* 🌟 EXACT CLOSURE TIMESTAMP & TECHNICIAN ATTRIBUTION */}
                          <div className="bg-white/90 border border-slate-200 rounded-xl p-2.5 mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-6 rounded-lg bg-blue-100 text-blue-700 grid place-items-center font-bold text-xs">
                                🔧
                              </span>
                              <span>
                                Technician: <b className="text-blue-700">{call.techName || call.closedByName || 'Technician'}</b>
                              </span>
                            </div>

                            {isClosed && (
                              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                                <FiCheckCircle className="text-emerald-600 text-sm" />
                                <span className="text-emerald-950 font-bold">
                                  Closed: {fmtDate(closedTimestamp)}
                                </span>
                                <span className="text-[11px] text-emerald-700 font-medium">
                                  ({timeAgo(closedTimestamp)})
                                </span>
                              </div>
                            )}

                            {!isClosed && call.createdAt && (
                              <div className="text-slate-500 text-xs">
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

function SmallCard({ icon, label, value, subtext, color, highlight }) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3 transition ${
        highlight ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200' : 'bg-white border-slate-200'
      }`}
    >
      <div className={`h-11 w-11 rounded-xl ${color} text-white grid place-items-center shadow-sm text-lg flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-slate-500 uppercase truncate">{label}</div>
        <div className={`font-extrabold text-lg sm:text-xl truncate ${highlight ? 'text-amber-900' : 'text-slate-900'}`}>
          {value}
        </div>
        {subtext && <div className="text-[10px] text-slate-400 truncate">{subtext}</div>}
      </div>
    </motion.div>
  );
}
