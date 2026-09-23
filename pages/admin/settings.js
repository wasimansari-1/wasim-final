// pages/admin/settings.js
"use client";

import { useEffect, useState } from "react";
import Header from "../../components/Header";
import toast from "react-hot-toast";
import { FiSettings, FiCheck, FiShield, FiCreditCard } from "react-icons/fi";

export default function AdminSettings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowDirectMarkPaid, setAllowDirectMarkPaid] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) {
          window.location.href = "/login";
          return;
        }
        const u = await meRes.json();
        if (u.role !== "admin") {
          window.location.href = "/login";
          return;
        }
        setUser(u);

        // Fetch settings
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data?.settings) {
            setAllowDirectMarkPaid(Boolean(data.settings.allowDirectMarkPaid));
          }
        }
      } catch (err) {
        console.error("Settings load error:", err);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async (newValue) => {
    try {
      setSaving(true);
      setAllowDirectMarkPaid(newValue);

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowDirectMarkPaid: newValue }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update settings");
      }

      toast.success(
        newValue
          ? "✅ Tech 'Paid' Button is now ENABLED (ON)"
          : "🔒 Tech 'Paid' Button is now DISABLED (OFF)"
      );
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save setting");
      // Revert on error
      setAllowDirectMarkPaid(!newValue);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <Header user={user} />
        <div className="max-w-4xl mx-auto p-4 flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <Header user={user} />

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <FiSettings className="text-blue-600" />
              <span>Admin Settings</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Manage system configurations and technician portal permissions
            </p>
          </div>
        </div>

        {/* Setting Card */}
        <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <FiCreditCard size={18} />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Technician Direct "Paid" Button Control
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                When enabled (<strong>ON</strong>), technicians will see the green <strong>[Paid]</strong> button inside the "Select Calls for Payment" modal in their Payments portal. Clicking it will mark that call as Paid directly in the database without adding it to Admin Payments reports.
              </p>
              <p className="text-xs text-slate-500">
                When disabled (<strong>OFF</strong>), the [Paid] button is hidden from all technicians.
              </p>
            </div>

            {/* Switch */}
            <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                allowDirectMarkPaid
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {allowDirectMarkPaid ? "ACTIVE (ON)" : "DISABLED (OFF)"}
              </span>

              <button
                type="button"
                onClick={() => handleToggle(!allowDirectMarkPaid)}
                disabled={saving}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  allowDirectMarkPaid ? "bg-emerald-600" : "bg-slate-300"
                } ${saving ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    allowDirectMarkPaid ? "translate-x-7" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
