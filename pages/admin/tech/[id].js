// pages/admin/tech/[id].js
import Header from "../../../components/Header";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { FiUser, FiCalendar, FiCreditCard, FiDollarSign } from "react-icons/fi";
import { FaMoneyBillWave } from "react-icons/fa";

export default function TechDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(null);
  const [info, setInfo] = useState(null);
  const [summary, setSummary] = useState({ today: 0, total: 0, online: 0, cash: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) {
          router.replace("/login");
          return;
        }
        const u = await meRes.json();
        if (u.role !== "admin") {
          router.replace("/login");
          return;
        }
        if (isMounted) setUser(u);

        // Fetch tech info & summary concurrently
        const [infoRes, summaryRes] = await Promise.all([
          fetch(`/api/admin/tech-info?id=${encodeURIComponent(id)}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/admin/tech-summary?id=${encodeURIComponent(id)}`).then((r) => r.json()).catch(() => null),
        ]);

        if (isMounted) {
          if (infoRes && !infoRes.error) setInfo(infoRes);
          if (summaryRes && !summaryRes.error) setSummary(summaryRes);
        }
      } catch (err) {
        console.error("TechDetail load error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [id, router]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header user={user} />
      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-white rounded-3xl border border-slate-200" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200" />
              ))}
            </div>
          </div>
        ) : info ? (
          <>
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white grid place-items-center font-black text-lg shadow-sm">
                  {info.username ? info.username.slice(0, 2).toUpperCase() : "TC"}
                </div>
                <div>
                  <div className="text-lg font-black text-slate-900 tracking-tight">{info.username}</div>
                  <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 mt-0.5">
                    <FiCalendar size={12} className="text-slate-400" />
                    <span>Joined: {info.createdAt ? new Date(info.createdAt).toLocaleDateString("en-IN") : "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Today Collection</div>
                <div className="text-xl sm:text-2xl font-black text-indigo-600">₹{summary.today || 0}</div>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Collection</div>
                <div className="text-xl sm:text-2xl font-black text-slate-900">₹{summary.total || 0}</div>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FiCreditCard size={11} className="text-blue-600" /> Online
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-600">₹{summary.online || 0}</div>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FaMoneyBillWave size={11} className="text-emerald-600" /> Cash
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-600">₹{summary.cash || 0}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 text-center text-slate-500">
            Technician details not found.
          </div>
        )}
      </main>
    </div>
  );
}
