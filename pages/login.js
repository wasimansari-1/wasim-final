import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function Login() {
  const [role, setRole] = useState("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    (async () => {
      try {
        const r = await fetch("/api/auth/me");
        if (r.ok) {
          const u = await r.json();
          if (u?.id) {
            localStorage.setItem("userId", u.id);
            localStorage.setItem("userRole", u.role || "technician");
            if (u.username) localStorage.setItem("username", u.username);
          }
          if (u.role === "admin") window.location.href = "/admin";
          if (u.role === "technician") window.location.href = "/tech";
        }
      } catch (err) {
        console.error("Auto-login check failed:", err);
      }
    })();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch(`/api/auth/login-${role}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(d.error || "Login failed");

      if (d?.user) {
        localStorage.setItem("userId", d.user.id);
        localStorage.setItem("userRole", d.user.role);
        localStorage.setItem("username", d.user.username);

        // Sync device token to user
        const existingToken = localStorage.getItem("fcmToken");
        if (existingToken) {
          fetch("/api/save-fcm-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: existingToken,
              userId: d.user.id,
              username: d.user.username,
              role: d.user.role,
            }),
          }).catch(() => {});
        }
      }

      toast.success("Login successful 🎉");

      if (role === "admin") window.location.href = "/admin";
      else window.location.href = "/tech";
    } catch (err) {
      toast.error(err.message || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/20">
        <div className="text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-2xl grid place-items-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
            CS
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Chimney Solutions</h1>
          <p className="text-xs text-slate-500 mt-1">CRM Management Portal</p>
        </div>

        {/* Role toggle tabs */}
        <div className="grid grid-cols-2 gap-2 mb-5 p-1 bg-slate-100 rounded-2xl">
          <button
            onClick={() => setRole("admin")}
            type="button"
            className={`py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
              role === "admin"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Admin Login
          </button>
          <button
            onClick={() => setRole("technician")}
            type="button"
            className={`py-2.5 rounded-xl font-bold text-xs sm:text-sm transition ${
              role === "technician"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Technician Login
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 rounded-2xl shadow-lg shadow-blue-500/25 transition active:scale-[0.98] disabled:opacity-60 text-sm mt-2"
          >
            {loading ? "Logging in..." : `Sign In as ${role === "admin" ? "Admin" : "Technician"}`}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-6">
          {role === "technician"
            ? "Technician credentials are provided by the administrator."
            : "Authorized Administrator access only."}
        </p>
      </div>
    </div>
  );
}
