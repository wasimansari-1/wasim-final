// components/Header.js
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMenu,
  FiX,
  FiUser,
  FiHome,
  FiFileText,
  FiPhoneCall,
  FiDollarSign,
  FiUsers,
  FiPlus,
  FiLogOut,
  FiEdit,
  FiBell,
  FiPhoneForwarded,
  FiUserCheck,
  FiDatabase,
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import CustomNotificationModal from "./admin/CustomNotificationModal";

/** Safe, SSR-friendly reduced-motion hook */
function useSafeReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(!!mq.matches);
    update();
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } else {
      mq.addListener(update);
      return () => mq.removeListener("change", update);
    }
  }, []);
  return reduced;
}

export default function Header({ user = { role: "technician", name: "User", id: "" } }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const shouldReduceMotion = useSafeReducedMotion();

  // local "me" state - prefer prop but fetch fresh if needed (avatar etc.)
  const [me, setMe] = useState(user);
  const [imgError, setImgError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    setMe(user);
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user) return;
    if (user.role !== "technician") return;
    if (user.avatar) return;

    const ac = new AbortController();
    const sig = ac.signal;

    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin", signal: sig });
        if (!res.ok) return;
        const data = await res.json();
        if (!mountedRef.current) return;
        setMe((prev) => ({ ...(prev || {}), ...(data || {}) }));
      } catch (err) {}
    })();

    return () => {
      ac.abort();
    };
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const safeNavigate = (href) => {
    if (!href) return;
    if (router?.pathname === href) return;
    router.push(href);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {}
    finally { safeNavigate("/login"); }
  };

  const navLinks = useMemo(
    () => ({
      admin: [
        { href: "/admin", label: "Dashboard", icon: <FiHome /> },
        { href: "/admin/forms", label: "Customer Forms", icon: <FiFileText /> },
        { href: "/admin/forward", label: "Assign Call", icon: <FiPhoneForwarded /> },
        { href: "/admin/all-calls", label: "All Calls", icon: <FiEdit /> },
        { href: "/admin/all-customers", label: "Customers", icon: <FiUsers /> },
        { href: "/admin/technician-calls", label: "Closed / Tech Calls", icon: <FiUserCheck /> },
        { href: "/admin/payments", label: "Payments", icon: <FiDollarSign /> },
        { href: "/admin/whatsapp-reports", label: "WhatsApp Reports", icon: <FaWhatsapp className="text-[#25D366]" /> },
        { href: "/admin/backup", label: "Backup & Restore", icon: <FiDatabase /> },
        { href: "/admin/techs", label: "Technicians", icon: <FiUsers /> },
        { href: "/admin/create-tech", label: "+ Tech", icon: <FiPlus /> },
      ],

      technician: [
        { href: "/tech", label: "Service Form", icon: <FiHome /> },
        { href: "/tech/calls", label: "My Calls", icon: <FiPhoneCall /> },
        { href: "/tech/payments", label: "Payments", icon: <FiDollarSign /> },
        { href: "/tech/profile", label: "Profile", icon: <FiUser /> },
      ],
    }),
    []
  );

  const links = navLinks[me?.role] || [];
  const isActive = (href) => router.pathname === href || router.pathname?.startsWith(href + "/");

  const initials = (nameOrUsername) => {
    const name = nameOrUsername || me?.username || me?.name || "";
    const chars = (name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("");
    return chars || "U";
  };

  const isAdmin = me?.role === "admin";
  const avatarUrl = !imgError && (me?.avatar || me?.avatarUrl || null);

  return (
    <>
      <header
        className={[
          "sticky top-0 z-[90] transition-all duration-200",
          "bg-gradient-to-r from-[#1e3a8a] via-[#1d4ed8] to-[#1e40af]",
          "backdrop-blur-xl bg-opacity-95",
          scrolled ? "shadow-2xl shadow-blue-900/25" : "shadow-lg shadow-blue-900/10",
        ].join(" ")}
        role="banner"
      >
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-3 sm:px-6 py-2.5">
          {/* LEFT SIDE */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden text-2xl text-white hover:scale-105 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-white/60 rounded-lg p-1"
            >
              {menuOpen ? <FiX /> : <FiMenu />}
            </button>

            <Link href="/" className="select-none cursor-pointer group min-w-0">
              <div className="flex items-center gap-2">
                <motion.div
                  layout
                  className="h-9 w-9 rounded-xl bg-white/15 ring-1 ring-white/20 grid place-items-center shadow-inner"
                  whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
                  transition={{ duration: 0.12 }}
                >
                  <span className="text-white font-black text-sm">CS</span>
                </motion.div>
                <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-white truncate">
                  Chimney <span className="text-blue-200">Solutions</span>
                </h1>
              </div>
            </Link>
          </div>

          {/* DESKTOP NAV */}
          <nav aria-label="Primary" className="hidden md:flex items-center justify-center flex-1 min-w-0 px-3">
            {isAdmin ? (
              <div className="relative w-full max-w-[1000px]">
                <div className="relative bg-white/90 backdrop-blur rounded-[20px] p-1 shadow-sm ring-1 ring-black/5 flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {links.map((link) => {
                    const active = isActive(link.href);
                    return (
                      <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className="relative block">
                        <span
                          className={[
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-[16px] text-xs font-semibold whitespace-nowrap",
                            "transition duration-150",
                            active ? "text-white" : "text-gray-700 hover:text-gray-900 hover:bg-black/5",
                          ].join(" ")}
                        >
                          {active && (
                            <motion.span
                              layoutId="adminTabHighlight"
                              transition={{ duration: 0.15 }}
                              className="absolute inset-0 rounded-[16px] bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm"
                              aria-hidden="true"
                            />
                          )}
                          <span className="relative z-[1] text-sm opacity-90">{link.icon}</span>
                          <span className="relative z-[1] truncate">{link.label}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 min-w-0 overflow-x-auto no-scrollbar md:flex-wrap gap-1.5 text-sm text-white font-medium">
                {links.map((link) => (
                  <div key={link.href} className="relative group shrink-0">
                    <Link
                      href={link.href}
                      className={[
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-150 font-semibold text-xs",
                        isActive(link.href)
                          ? "bg-white/20 ring-1 ring-white/30 text-white shadow-sm"
                          : "text-white/80 hover:text-white hover:bg-white/10",
                      ].join(" ")}
                    >
                      <span className="text-sm" aria-hidden="true">{link.icon}</span>
                      <span className="truncate">{link.label}</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </nav>

          {/* RIGHT PROFILE & ACTIONS */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Admin Custom Notification Trigger */}
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => setNotifModalOpen(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-950 px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition"
                title="Send Custom Push Notification"
              >
                <FiBell className="text-sm animate-bounce" />
                <span className="hidden sm:inline">Push Alert</span>
              </motion.button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm text-white font-semibold shadow-inner transition active:scale-95"
              >
                <div className="h-7 w-7 rounded-full bg-white/20 ring-1 ring-white/30 grid place-items-center overflow-hidden">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={me?.username || me?.name || "profile"}
                      className="h-full w-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <span className="text-[11px] font-bold">{initials(me?.displayName || me?.username || me?.name)}</span>
                  )}
                </div>
                <span className="hidden sm:block max-w-[120px] truncate">{me?.displayName || me?.username || me?.name || "Profile"}</span>
                <FiUser aria-hidden="true" className="opacity-80" />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl overflow-hidden z-[120] ring-1 ring-black/5"
                    role="menu"
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Signed in as</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{me?.displayName || me?.username || me?.name || "User"}</p>
                      <p className="text-[11px] text-gray-500">Role: <span className="font-semibold text-blue-600">{me?.role || "guest"}</span></p>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          setNotifModalOpen(true);
                        }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-amber-700 hover:bg-amber-50 transition text-sm font-medium"
                        role="menuitem"
                      >
                        <FiBell aria-hidden="true" /> Send Push Notification
                      </button>
                    )}

                    <Link
                      href={me?.role === "admin" ? "/admin" : "/tech/profile"}
                      className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-blue-50 transition text-sm font-medium"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <FiUser aria-hidden="true" /> My Profile
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 transition text-sm font-medium border-t border-gray-100"
                      role="menuitem"
                    >
                      <FiLogOut aria-hidden="true" /> Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE MENU DRAWER */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              key="overlay"
              className="fixed inset-0 bg-black/50 backdrop-blur-sm md:hidden z-[100]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMenuOpen(false)}
            />

            <motion.nav
              key="drawer"
              aria-label="Mobile"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2 }}
              className="fixed top-0 left-0 w-80 max-w-[85vw] h-full bg-gradient-to-b from-[#1d4ed8] to-[#1e3a8a] text-white z-[110] p-5 flex flex-col shadow-2xl md:hidden overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/15">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-white/20 grid place-items-center ring-1 ring-white/20">
                    <span className="text-xs font-bold">CS</span>
                  </div>
                  <span className="font-extrabold text-base">Chimney Solutions</span>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  className="text-2xl p-1 rounded-lg hover:bg-white/10"
                >
                  <FiX />
                </button>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setNotifModalOpen(true);
                  }}
                  className="mb-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-400 text-amber-950 font-bold text-sm shadow-md active:scale-95 transition"
                >
                  <FiBell className="text-base" /> Send Push Notification
                </button>
              )}

              <p className="text-xs uppercase tracking-wider text-white/70 mb-2 font-bold">
                {me?.role === "admin" ? "Admin Navigation" : "Technician Navigation"}
              </p>

              <div className="space-y-1">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={[
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition",
                      isActive(link.href) ? "bg-white/20 ring-1 ring-white/30 text-white font-semibold" : "hover:bg-white/10 text-white/90",
                    ].join(" ")}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="text-base" aria-hidden="true">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>

              <div className="mt-auto pt-5 border-t border-white/15">
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-white text-sm font-semibold transition shadow-lg"
                >
                  <FiLogOut aria-hidden="true" /> Logout
                </button>
                <p className="text-[11px] text-white/70 mt-3 text-center">Chimney Solutions CRM • v2.0</p>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Custom Notification Modal */}
      {isAdmin && (
        <CustomNotificationModal
          isOpen={notifModalOpen}
          onClose={() => setNotifModalOpen(false)}
        />
      )}
    </>
  );
}
