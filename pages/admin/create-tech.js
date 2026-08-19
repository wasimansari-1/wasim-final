"use client";

import Header from "../../components/Header";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiUserPlus, FiUser, FiLock, FiPhone } from "react-icons/fi";
import Link from "next/link";

export default function CreateTech() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ username: "", password: "", name: "", phone: "" });
  const [loading, setLoading] = useState(false);

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
      } catch {
        window.location.href = "/login";
      }
    })();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const r = await fetch("/api/admin/create-tech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to create technician");
        return;
      }

      toast.success("Technician created successfully 🎉");
      setForm({ username: "", password: "", name: "", phone: "" });
    } catch (err) {
      toast.error(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-lg mx-auto p-4 sm:p-6 space-y-4">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white grid place-items-center shadow-md">
              <FiUserPlus size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Create Technician</h1>
              <p className="text-xs text-slate-500">Add a new field technician to your CRM team.</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label flex items-center gap-1"><FiUser /> Full Name</label>
              <input
                className="input"
                placeholder="e.g. Rahul Sharma"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="label flex items-center gap-1"><FiUser /> Login Username *</label>
              <input
                className="input"
                placeholder="e.g. rahul123"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label flex items-center gap-1"><FiPhone /> Mobile Number</label>
              <input
                type="tel"
                className="input"
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="label flex items-center gap-1"><FiLock /> Login Password *</label>
              <input
                type="password"
                className="input"
                placeholder="Set secure password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl shadow-md transition active:scale-95 disabled:opacity-60 text-sm mt-2"
            >
              {loading ? "Creating..." : "Create Technician Account"}
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link href="/admin/techs" className="text-xs font-semibold text-blue-600 hover:underline">
              ← Back to Technicians List
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
