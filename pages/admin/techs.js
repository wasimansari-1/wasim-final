import Header from "../../components/Header";
import Link from "next/link";
import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  FiUserPlus,
  FiTrash2,
  FiEye,
  FiEyeOff,
  FiBell,
  FiPhone,
  FiCalendar,
  FiCopy,
  FiKey,
  FiSearch,
  FiUser,
  FiCheck,
  FiX,
  FiLock,
  FiExternalLink,
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import CustomNotificationModal from "../../components/admin/CustomNotificationModal";

const vibrate = (pattern = [30]) => {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
};

export default function Techs() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Revealed passwords state: { [techId]: boolean }
  const [revealedPasswords, setRevealedPasswords] = useState({});

  // Modals state
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [resetPassModal, setResetPassModal] = useState(null); // tech object or null
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) {
          window.location.href = "/login";
          return;
        }
        const u = await me.json();

        if (u.role !== "admin") {
          window.location.href = "/login";
          return;
        }

        setUser(u);
        await loadTechs();
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadTechs() {
    try {
      const r = await fetch("/api/admin/techs", { cache: "no-store" });
      const d = await r.json();
      setItems(d.items || []);
    } catch (e) {
      console.error("Error loading techs:", e);
    }
  }

  const toggleRevealPassword = useCallback((techId) => {
    vibrate([15]);
    setRevealedPasswords((prev) => ({
      ...prev,
      [techId]: !prev[techId],
    }));
  }, []);

  const copyToClipboard = useCallback((text, label = "Text") => {
    if (!text) return;
    vibrate([20]);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`Copied ${label}!`, { id: "copy-toast", icon: "📋" });
    }
  }, []);

  const shareOnWhatsApp = useCallback((tech) => {
    vibrate([20]);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const loginUrl = `${origin}/login`;
    const pass = tech.password || tech.plainPassword || "[Your set password]";

    const message = `🔑 *Chimney Solutions CRM - Technician Login*\n\n👤 *Username:* ${tech.username}\n🔒 *Password:* ${pass}\n🌐 *Login Link:* ${loginUrl}\n\n_Please login and keep your credentials secure._`;

    const cleanPhone = (tech.phone || "").replace(/\D+/g, "");
    const waUrl = cleanPhone.length >= 10
      ? `https://wa.me/${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, "_blank");
  }, []);

  // Handle Update / Reset Password
  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetPassModal || !newPassword.trim()) return;

    try {
      setResetting(true);
      vibrate([25]);

      const res = await fetch("/api/admin/update-tech-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          techId: resetPassModal._id,
          password: newPassword.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || (!data.ok && !data.success)) {
        toast.error(data.error || "Failed to update password");
        return;
      }

      toast.success(`Password updated for @${resetPassModal.username} 🎉`);

      // Update local item state
      setItems((prev) =>
        prev.map((t) =>
          t._id === resetPassModal._id
            ? { ...t, password: newPassword.trim(), plainPassword: newPassword.trim() }
            : t
        )
      );

      // Auto-reveal the newly updated password
      setRevealedPasswords((prev) => ({
        ...prev,
        [resetPassModal._id]: true,
      }));

      setResetPassModal(null);
      setNewPassword("");
    } catch (err) {
      console.error(err);
      toast.error("Error updating password");
    } finally {
      setResetting(false);
    }
  }

  async function deleteTech(id) {
    try {
      const r = await fetch("/api/admin/delete-tech?id=" + id, {
        method: "DELETE",
      });

      const d = await r.json();

      if (!d.success) {
        toast.error("Error deleting technician");
        return;
      }

      toast.success("Technician deleted successfully");
      setItems((prev) => prev.filter((t) => t._id !== id));
      setConfirmDelete(null);
    } catch (e) {
      toast.error("Failed to delete");
    }
  }

  const filteredTechs = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.username || "").toLowerCase().includes(q) ||
        (t.phone || "").includes(q)
    );
  }, [items, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-3.5 sm:p-6 space-y-6">
        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Technicians Directory
              </h1>
              <span className="bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-0.5 rounded-full">
                {items.length} Techs
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Manage field technician profiles, login IDs, passwords & credentials.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setNotifModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-2xl shadow-xs text-xs sm:text-sm font-extrabold transition active:scale-95 cursor-pointer"
            >
              <FiBell />
              <span>Broadcast Alert</span>
            </button>

            <Link
              href="/admin/create-tech"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-md shadow-blue-500/20 text-xs sm:text-sm font-extrabold transition active:scale-95"
            >
              <FiUserPlus />
              <span>+ Create Technician</span>
            </Link>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative max-w-md">
          <FiSearch className="absolute left-3.5 top-3.5 text-slate-400 text-base" />
          <input
            type="text"
            placeholder="Search by name, username (@...), or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-2xs transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
            >
              <FiX size={14} />
            </button>
          )}
        </div>

        {/* LOADING SKELETONS */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-64 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-200" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                    <div className="h-3 bg-slate-200 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-20 bg-slate-100 rounded-2xl" />
              </div>
            ))}
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && filteredTechs.length === 0 && (
          <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center max-w-md mx-auto space-y-3">
            <div className="text-4xl">👨‍🔧</div>
            <h3 className="text-base font-bold text-slate-800">No Technicians Found</h3>
            <p className="text-xs text-slate-500">
              {searchQuery ? "No technicians match your search." : "No technicians have been created yet."}
            </p>
            <Link
              href="/admin/create-tech"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition"
            >
              <FiUserPlus /> Create First Technician
            </Link>
          </div>
        )}

        {/* TECHNICIANS GRID */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTechs.map((t) => {
              const isPasswordRevealed = !!revealedPasswords[t._id];
              const displayPassword = t.password || t.plainPassword;

              return (
                <motion.div
                  key={t._id}
                  layout
                  className="bg-white border border-slate-200/90 shadow-sm rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:shadow-md hover:border-blue-300 transition"
                >
                  {/* Top Profile Header */}
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white font-black grid place-items-center text-base flex-shrink-0 shadow-md shadow-blue-500/20 overflow-hidden">
                      {t.avatar ? (
                        <img
                          src={t.avatar}
                          alt={t.name || t.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (t.name || t.username || "T")[0].toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 justify-between">
                        <h3 className="text-base font-extrabold text-slate-900 truncate">
                          {t.name || t.username}
                        </h3>
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                          Active
                        </span>
                      </div>

                      <div className="text-xs font-bold text-blue-600 truncate flex items-center gap-1 mt-0.5">
                        <span>@{t.username}</span>
                      </div>

                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 truncate">
                        <FiPhone size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">{t.phone || "No phone registered"}</span>
                      </div>

                      {t.createdAt && (
                        <div className="text-[10.5px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <FiCalendar size={10} className="shrink-0" />
                          <span>Joined {new Date(t.createdAt).toLocaleDateString("en-IN")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 🔐 LOGIN CREDENTIALS BOX (HIGH VISIBILITY) */}
                  <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200/60">
                      <span className="flex items-center gap-1">
                        <FiLock className="text-blue-600" /> Login Credentials
                      </span>
                      <button
                        type="button"
                        onClick={() => shareOnWhatsApp(t)}
                        className="text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1 transition cursor-pointer text-[10px]"
                        title="Send login details to technician on WhatsApp"
                      >
                        <FaWhatsapp size={12} /> Share
                      </button>
                    </div>

                    {/* Username Field */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500 font-semibold shrink-0">Login ID:</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <code className="bg-white border border-slate-200 px-2 py-0.5 rounded-lg font-mono font-bold text-slate-900 truncate">
                          {t.username}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(t.username, "Username")}
                          className="p-1 rounded-md bg-white hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition border border-slate-200 cursor-pointer"
                          title="Copy Username"
                        >
                          <FiCopy size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Password Field */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500 font-semibold shrink-0">Password:</span>
                      <div className="flex items-center gap-1 min-w-0">
                        {displayPassword ? (
                          <>
                            <code className="bg-white border border-slate-200 px-2 py-0.5 rounded-lg font-mono font-bold text-slate-900 max-w-[120px] truncate">
                              {isPasswordRevealed ? displayPassword : "••••••••"}
                            </code>

                            {/* Show / Hide Toggle */}
                            <button
                              type="button"
                              onClick={() => toggleRevealPassword(t._id)}
                              className="p-1 rounded-md bg-white hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition border border-slate-200 cursor-pointer"
                              title={isPasswordRevealed ? "Hide Password" : "Show Password"}
                            >
                              {isPasswordRevealed ? <FiEyeOff size={12} /> : <FiEye size={12} />}
                            </button>

                            {/* Copy Password */}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(displayPassword, "Password")}
                              className="p-1 rounded-md bg-white hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition border border-slate-200 cursor-pointer"
                              title="Copy Password"
                            >
                              <FiCopy size={11} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                            Hashed (Old)
                          </span>
                        )}

                        {/* Reset Password Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setResetPassModal(t);
                            setNewPassword("");
                            setShowNewPassword(false);
                            vibrate([15]);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10.5px] font-bold border border-blue-200 transition cursor-pointer flex items-center gap-0.5 shrink-0"
                          title="Reset / Change Password"
                        >
                          <FiKey size={10} /> Reset
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM ACTIONS */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <Link
                      href={`/admin/tech/${t._id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition shadow-2xs"
                    >
                      <FiEye /> View Stats
                    </Link>

                    <button
                      onClick={() => setConfirmDelete(t)}
                      className="inline-flex items-center justify-center p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition cursor-pointer"
                      title="Delete Technician"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* 🔑 RESET PASSWORD MODAL */}
      {/* ======================================================== */}
      <AnimatePresence>
        {resetPassModal && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] p-4"
            onClick={() => setResetPassModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              className="bg-white p-5 sm:p-6 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white grid place-items-center shadow-xs">
                    <FiKey size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Reset Password
                    </h2>
                    <p className="text-xs text-slate-500">
                      For <span className="font-bold text-blue-600">@{resetPassModal.username}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setResetPassModal(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <FiX size={18} />
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="Enter new password (e.g. tech@123)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showNewPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    The technician will be able to log in immediately with this password.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetPassModal(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={resetting || !newPassword.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {resetting ? "Updating..." : "Save Password"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 🗑️ DELETE CONFIRM POPUP */}
      {/* ======================================================== */}
      <AnimatePresence>
        {confirmDelete && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-slate-900">Delete Technician?</h2>

              <p className="text-slate-600 text-xs leading-relaxed">
                Are you sure you want to delete technician <b>@{confirmDelete.username}</b>? This action cannot be undone.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => deleteTech(confirmDelete._id)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow cursor-pointer"
                >
                  Delete Technician
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Notification Modal */}
      <CustomNotificationModal
        isOpen={notifModalOpen}
        onClose={() => setNotifModalOpen(false)}
      />
    </div>
  );
}
