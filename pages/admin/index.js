// pages/admin/index.js
import Header from "../../components/Header";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { FiBell, FiPhoneForwarded, FiCheckCircle, FiUsers, FiDollarSign } from "react-icons/fi";

// Firebase Notifications
import { db } from "../../lib/firebase";
import { collection, query, where, orderBy, onSnapshot, limit } from "firebase/firestore";

// Premium Popups
import TechnicianPopup from "../../components/admin/TechnicianPopup";
import FormsPopup from "../../components/admin/FormsPopup";
import ForwardedPopup from "../../components/admin/ForwardedPopup";
import PaymentPopup from "../../components/admin/PaymentPopup";
import CustomNotificationModal from "../../components/admin/CustomNotificationModal";

export default function AdminHome() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // POPUPS
  const [openTech, setOpenTech] = useState(false);
  const [openForms, setOpenForms] = useState(false);
  const [openForwarded, setOpenForwarded] = useState(false);
  const [openPayments, setOpenPayments] = useState(false);
  const [openCustomNotif, setOpenCustomNotif] = useState(false);

  // FAST FETCH
  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) return (window.location.href = "/login");

        const u = await me.json();
        if (u.role !== "admin") return (window.location.href = "/login");
        setUser(u);

        const sumRes = await fetch("/api/admin/summary");
        const sum = await sumRes.json();
        setStats(sum);

        setChartData([
          { name: "Mon", calls: 12, forms: 5 },
          { name: "Tue", calls: 21, forms: 7 },
          { name: "Wed", calls: 17, forms: 6 },
          { name: "Thu", calls: 33, forms: 10 },
          { name: "Fri", calls: 28, forms: 9 },
          { name: "Sat", calls: 15, forms: 4 },
        ]);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load dashboard statistics");
      }
    })();
  }, []);

  // NOTIFICATION LISTENER
  useEffect(() => {
    if (!user || !db) return;

    try {
      const q = query(
        collection(db, "notifications"),
        where("to", "==", "admin"),
        orderBy("createdAt", "desc"),
        limit(20)
      );

      const unsub = onSnapshot(q, (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (data.length > notifications.length && notifications.length > 0) {
          const newest = data[0];
          toast.success(`🔔 ${newest.message || newest.title}`);
          try {
            new Audio("/forward.mp3").play().catch(() => {});
          } catch {}
        }

        setNotifications(data);
      });

      return () => unsub();
    } catch (e) {
      console.warn("Firestore listener warning:", e);
    }
  }, [user, notifications.length]);

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Dashboard Title & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <motion.h1
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Admin Dashboard
            </motion.h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Welcome back, <span className="font-semibold text-slate-800">{user?.username || "Admin"}</span> • CRM Overview
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setOpenCustomNotif(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-950 font-bold text-xs sm:text-sm shadow-md transition active:scale-95"
            >
              <FiBell className="text-base" /> Send Push Notification
            </button>

            <Link
              href="/admin/forward"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md transition active:scale-95"
            >
              <FiPhoneForwarded /> Forward Call
            </Link>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {!stats ? (
            [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-28 bg-white shadow-sm border border-slate-100 animate-pulse rounded-2xl"
              />
            ))
          ) : (
            <>
              <StatCard title="Technicians" value={stats.techs} color="blue" onClick={() => setOpenTech(true)} />
              <StatCard title="Customer Forms" value={stats.forms} color="green" onClick={() => setOpenForms(true)} />
              <StatCard title="Forwarded Calls" value={stats.calls} color="yellow" onClick={() => setOpenForwarded(true)} />
              <StatCard title="Total Payments" value={`₹${stats.totalPayments}`} color="purple" onClick={() => setOpenPayments(true)} />
            </>
          )}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Line Chart */}
          <motion.div
            className="bg-white shadow-sm p-5 sm:p-6 rounded-3xl border border-slate-100"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-slate-800 text-base">Weekly Activity Trends</h2>
              <span className="text-xs text-slate-400">Calls & Forms</span>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <Line type="monotone" dataKey="calls" stroke="#2563eb" strokeWidth={3} dot={false} name="Calls" />
                <Line type="monotone" dataKey="forms" stroke="#16a34a" strokeWidth={3} dot={false} name="Forms" />
                <CartesianGrid stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Pie chart */}
          <motion.div
            className="bg-white shadow-sm p-5 sm:p-6 rounded-3xl border border-slate-100"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-slate-800 text-base">Platform Distribution</h2>
              <span className="text-xs text-slate-400">Overall Ratio</span>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  outerRadius={80}
                  label
                  dataKey="value"
                  data={[
                    { name: "Technicians", value: stats?.techs || 0 },
                    { name: "Forms", value: stats?.forms || 0 },
                    { name: "Calls", value: stats?.calls || 0 },
                    { name: "Payments", value: stats?.totalPayments || 0 },
                  ]}
                >
                  {COLORS.map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Recent Forwarded Calls & Closure Status */}
        <motion.div
          className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Recent Forwarded Calls & Closure Audit</h2>
              <p className="text-xs text-slate-500">Live feed of call statuses and closure timestamps</p>
            </div>

            <Link href="/admin/all-calls" className="text-xs font-bold text-blue-600 hover:text-blue-700 underline">
              View All Calls →
            </Link>
          </div>

          <RecentForwarded />
        </motion.div>
      </main>

      {/* POPUPS */}
      <AnimatePresence>
        {openTech && <TechnicianPopup onClose={() => setOpenTech(false)} />}
        {openForms && <FormsPopup onClose={() => setOpenForms(false)} />}
        {openForwarded && <ForwardedPopup onClose={() => setOpenForwarded(false)} />}
        {openPayments && <PaymentPopup onClose={() => setOpenPayments(false)} />}
        {openCustomNotif && <CustomNotificationModal isOpen={openCustomNotif} onClose={() => setOpenCustomNotif(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- STAT CARD ---------------- */
function StatCard({ title, value, color, onClick }) {
  const palette = {
    blue: "from-blue-600 to-indigo-700",
    green: "from-emerald-500 to-teal-700",
    yellow: "from-amber-500 to-orange-600",
    purple: "from-purple-600 to-indigo-800",
  };

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`p-4 sm:p-5 rounded-3xl cursor-pointer text-white bg-gradient-to-br ${palette[color]} shadow-md relative overflow-hidden transition`}
    >
      <div className="text-xs font-semibold uppercase tracking-wider opacity-90">{title}</div>
      <div className="text-2xl sm:text-3xl font-black mt-1">{value}</div>

      <div className="absolute text-7xl -bottom-5 -right-3 font-bold opacity-15 select-none pointer-events-none">
        +
      </div>
    </motion.div>
  );
}

/* -------------- RECENT FORWARDED TABLE ---------------- */
function RecentForwarded() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRecent = async () => {
    try {
      const r = await fetch("/api/admin/forwarded?limit=10");
      const d = await r.json();
      setItems(d.items || []);
    } catch (e) {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="text-center py-6 text-slate-400 text-xs">No forwarded calls yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-600 text-left border-b border-slate-100">
            <th className="p-3">Client</th>
            <th className="p-3">Phone</th>
            <th className="p-3">Technician</th>
            <th className="p-3">Status</th>
            <th className="p-3">Closure / Date</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {items.map((it) => {
            const isClosed = it.status === "Closed" || it.status === "Completed";
            const closedTimestamp = it.closedAt || (isClosed ? it.updatedAt : null);

            return (
              <tr key={it._id} className="hover:bg-blue-50/50 transition">
                <td className="p-3 font-semibold text-slate-900">{it.clientName}</td>
                <td className="p-3 text-slate-600">{it.phone}</td>
                <td className="p-3 font-medium text-blue-600">{it.techName || "—"}</td>
                <td className="p-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isClosed
                        ? "bg-emerald-100 text-emerald-800"
                        : it.status === "Pending"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {it.status}
                  </span>
                </td>
                <td className="p-3 text-slate-500 text-xs">
                  {isClosed && closedTimestamp ? (
                    <span className="text-emerald-700 font-medium">
                      Closed: {new Date(closedTimestamp).toLocaleString("en-IN")}
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
  );
}
