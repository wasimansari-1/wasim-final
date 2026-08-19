import Header from "../../components/Header";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { FiUserPlus, FiTrash2, FiEye, FiBell, FiPhone, FiCalendar } from "react-icons/fi";
import CustomNotificationModal from "../../components/admin/CustomNotificationModal";

export default function Techs() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      const u = await me.json();

      if (u.role !== "admin") {
        window.location.href = "/login";
        return;
      }

      setUser(u);
      loadTechs();
    })();
  }, []);

  async function loadTechs() {
    try {
      const r = await fetch("/api/admin/techs", { cache: "no-store" });
      const d = await r.json();
      setItems(d.items || []);
    } catch (e) {
      console.error(e);
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
      setItems(items.filter((t) => t._id !== id));
      setConfirmDelete(null);
    } catch (e) {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* PAGE TITLE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Technicians Directory</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Manage field technician profiles, assigned calls, and direct push messaging.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setNotifModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-2xl shadow-sm text-xs sm:text-sm font-bold transition active:scale-95"
            >
              <FiBell /> Broadcast Push Alert
            </button>

            <Link
              href="/admin/create-tech"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-sm text-xs sm:text-sm font-bold transition active:scale-95"
            >
              <FiUserPlus /> Create Technician
            </Link>
          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((t) => (
            <motion.div
              key={t._id}
              whileHover={{ scale: 1.01 }}
              className="bg-white border border-slate-200 shadow-sm rounded-3xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md hover:border-blue-300 transition"
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold grid place-items-center text-lg flex-shrink-0 shadow-sm">
                  {t.avatar ? (
                    <img src={t.avatar} alt={t.name || t.username} className="h-full w-full object-cover rounded-2xl" />
                  ) : (
                    (t.name || t.username || "?")[0].toUpperCase()
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {t.name || t.username}
                  </h3>
                  <div className="text-xs text-blue-600 font-semibold truncate">@{t.username}</div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <FiPhone className="text-slate-400" /> {t.phone || "No phone registered"}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <FiCalendar /> Joined {new Date(t.createdAt).toLocaleDateString("en-IN")}
                  </div>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <Link
                  href={`/admin/tech/${t._id}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition"
                >
                  <FiEye /> View Stats
                </Link>

                <button
                  onClick={() => setConfirmDelete(t)}
                  className="inline-flex items-center justify-center p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition"
                  title="Delete Technician"
                >
                  <FiTrash2 />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* DELETE CONFIRM POPUP */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100 space-y-4"
            >
              <h2 className="text-lg font-bold text-slate-900">Delete Technician?</h2>

              <p className="text-slate-600 text-xs leading-relaxed">
                Are you sure you want to delete <b>{confirmDelete.username}</b>? This action cannot be undone.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>

                <button
                  onClick={() => deleteTech(confirmDelete._id)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow"
                >
                  Delete Technician
                </button>
              </div>
            </motion.div>
          </motion.div>
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
