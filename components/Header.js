// components/Header.js
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  FiCheck,
} from "react-icons/fi";
import { FaWhatsapp, FaPalette } from "react-icons/fa";
import CustomNotificationModal from "./admin/CustomNotificationModal";
import toast from "react-hot-toast";

/** 🎨 7 Premium Curated Themes */
export const CRM_THEMES = [
  {
    id: "classic-blue",
    name: "Classic Blue",
    category: "Original",
    icon: "🔷",
    headerBg: "bg-gradient-to-r from-[#1e3a8a] via-[#1d4ed8] to-[#1e40af]",
    headerText: "text-white",
    subText: "text-blue-200",
    badgeBg: "bg-white/15 ring-white/25 text-white",
    activePill: "bg-white/20 ring-1 ring-white/30 text-white shadow-sm",
    inactivePill: "text-white/80 hover:text-white hover:bg-white/10",
    swatch: "from-[#1e3a8a] via-[#1d4ed8] to-[#1e40af]",
    isDarkHeader: true,
    drawerBg: "bg-gradient-to-b from-[#1d4ed8] to-[#1e3a8a] text-white",
  },
  {
    id: "dark",
    name: "Midnight Dark",
    category: "Dark Mode",
    icon: "🌙",
    headerBg: "bg-gradient-to-r from-slate-950 via-slate-900 to-zinc-950 border-b border-slate-800/90",
    headerText: "text-white",
    subText: "text-blue-400",
    badgeBg: "bg-blue-600 text-white shadow-md shadow-blue-500/30",
    activePill: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30",
    inactivePill: "text-slate-300 hover:text-white hover:bg-slate-800",
    swatch: "from-slate-950 via-slate-900 to-zinc-950",
    isDarkHeader: true,
    drawerBg: "bg-gradient-to-b from-slate-950 via-slate-900 to-zinc-950 text-white border-r border-slate-800",
  },
  {
    id: "light",
    name: "Pearl Light",
    category: "Light Mode",
    icon: "☀️",
    headerBg: "bg-gradient-to-r from-white via-slate-50 to-slate-100 border-b border-slate-200/90 shadow-sm",
    headerText: "text-slate-900",
    subText: "text-blue-600",
    badgeBg: "bg-blue-600 text-white shadow-sm",
    activePill: "bg-blue-600 text-white shadow-sm",
    inactivePill: "text-slate-700 hover:text-slate-900 hover:bg-slate-200/70",
    swatch: "from-white via-slate-100 to-slate-200",
    isDarkHeader: false,
    drawerBg: "bg-white text-slate-900 border-r border-slate-200 shadow-2xl",
  },
  {
    id: "yellow-fade",
    name: "Golden Fade",
    category: "Warm Accent",
    icon: "✨",
    headerBg: "bg-gradient-to-r from-amber-400 via-amber-200 to-white border-b border-amber-300/60 shadow-sm",
    headerText: "text-slate-900",
    subText: "text-amber-800",
    badgeBg: "bg-amber-500 text-slate-950 shadow-sm",
    activePill: "bg-amber-500 text-slate-950 font-bold shadow-sm",
    inactivePill: "text-slate-700 hover:text-slate-950 hover:bg-amber-200/60",
    swatch: "from-amber-400 via-amber-200 to-white",
    isDarkHeader: false,
    drawerBg: "bg-gradient-to-b from-amber-400 via-amber-200 to-white text-slate-900 border-r border-amber-200",
  },
  {
    id: "blue-fade",
    name: "Ocean Blue Fade",
    category: "Cool Fade",
    icon: "🌊",
    headerBg: "bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 shadow-md",
    headerText: "text-white",
    subText: "text-sky-100",
    badgeBg: "bg-white/20 ring-white/30 text-white",
    activePill: "bg-white/25 ring-1 ring-white/40 text-white shadow-sm",
    inactivePill: "text-white/80 hover:text-white hover:bg-white/10",
    swatch: "from-blue-600 via-sky-500 to-indigo-600",
    isDarkHeader: true,
    drawerBg: "bg-gradient-to-b from-blue-600 via-sky-600 to-indigo-800 text-white",
  },
  {
    id: "emerald-fade",
    name: "Emerald Green",
    category: "Nature",
    icon: "🌿",
    headerBg: "bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-900 shadow-md",
    headerText: "text-white",
    subText: "text-emerald-200",
    badgeBg: "bg-white/20 ring-white/30 text-white",
    activePill: "bg-white/20 ring-1 ring-white/30 text-white shadow-sm",
    inactivePill: "text-emerald-100 hover:text-white hover:bg-white/10",
    swatch: "from-emerald-800 via-teal-700 to-emerald-900",
    isDarkHeader: true,
    drawerBg: "bg-gradient-to-b from-teal-700 to-emerald-950 text-white",
  },
  {
    id: "sunset-rose",
    name: "Sunset Rose",
    category: "Vibrant",
    icon: "🌅",
    headerBg: "bg-gradient-to-r from-rose-700 via-pink-600 to-purple-800 shadow-md",
    headerText: "text-white",
    subText: "text-pink-200",
    badgeBg: "bg-white/20 ring-white/30 text-white",
    activePill: "bg-white/20 ring-1 ring-white/30 text-white shadow-sm",
    inactivePill: "text-rose-100 hover:text-white hover:bg-white/10",
    swatch: "from-rose-700 via-pink-600 to-purple-800",
    isDarkHeader: true,
    drawerBg: "bg-gradient-to-b from-pink-600 to-purple-900 text-white",
  },
];

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
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const shouldReduceMotion = useSafeReducedMotion();

  // Active theme state (defaults to classic-blue)
  const [activeThemeId, setActiveThemeId] = useState("classic-blue");

  // Load saved theme from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("crm_theme");
      if (saved && CRM_THEMES.some((t) => t.id === saved)) {
        setActiveThemeId(saved);
        document.documentElement.setAttribute("data-crm-theme", saved);
      }
    } catch {}
  }, []);

  const changeTheme = useCallback((themeId) => {
    setActiveThemeId(themeId);
    try {
      localStorage.setItem("crm_theme", themeId);
      document.documentElement.setAttribute("data-crm-theme", themeId);
      window.dispatchEvent(new Event("crm-theme-change"));
    } catch {}

    const selected = CRM_THEMES.find((t) => t.id === themeId);
    if (selected) {
      toast.success(`Theme: ${selected.name}`, { id: "theme-toast", icon: selected.icon });
    }
  }, []);

  const activeTheme = useMemo(() => {
    return CRM_THEMES.find((t) => t.id === activeThemeId) || CRM_THEMES[0];
  }, [activeThemeId]);

  // Local "me" state
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
        setThemeModalOpen(false);
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
          "sticky top-0 z-[90] transition-all duration-300 w-full max-w-full overflow-hidden",
          activeTheme.headerBg,
          activeTheme.headerText,
          "backdrop-blur-2xl",
          scrolled ? "shadow-xl" : "shadow-md",
        ].join(" ")}
        role="banner"
      >
        <div className="w-full max-w-screen-2xl mx-auto flex items-center justify-between px-2.5 sm:px-6 py-2 sm:py-2.5 gap-1.5 sm:gap-4">
          
          {/* LEFT SIDE: Hamburger & Brand Title */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className={`md:hidden text-xl sm:text-2xl p-1 rounded-xl cursor-pointer hover:bg-white/10 transition shrink-0 ${
                activeTheme.isDarkHeader ? "text-white" : "text-slate-900"
              }`}
            >
              {menuOpen ? <FiX /> : <FiMenu />}
            </button>

            <Link href="/" className="select-none cursor-pointer group min-w-0 flex items-center gap-1.5 sm:gap-2">
              <motion.div
                layout
                className={`h-7 w-7 sm:h-8 sm:w-8 rounded-xl grid place-items-center shadow-inner font-black text-[11px] sm:text-xs shrink-0 ${activeTheme.badgeBg}`}
                whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
                transition={{ duration: 0.12 }}
              >
                <span>CS</span>
              </motion.div>
              <div className="min-w-0">
                <h1 className="text-xs xs:text-sm sm:text-base md:text-lg font-black tracking-tight leading-tight whitespace-nowrap">
                  Chimney <span className={activeTheme.subText}>Solutions</span>
                </h1>
              </div>
            </Link>
          </div>

          {/* DESKTOP NAV BAR */}
          <nav aria-label="Primary" className="hidden md:flex items-center justify-center flex-1 min-w-0 px-3">
            {isAdmin ? (
              <div className="relative w-full max-w-[1000px]">
                <div className={`relative backdrop-blur rounded-2xl p-1 shadow-xs ring-1 flex items-center gap-1 overflow-x-auto no-scrollbar ${
                  activeTheme.isDarkHeader
                    ? "bg-white/10 ring-white/15"
                    : "bg-white/90 ring-black/10 border border-slate-200/80"
                }`}>
                  {links.map((link) => {
                    const active = isActive(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className="relative block"
                      >
                        <span
                          className={[
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition duration-150 relative",
                            active
                              ? "text-white font-extrabold"
                              : activeTheme.isDarkHeader
                              ? "text-white/80 hover:text-white hover:bg-white/10"
                              : "text-slate-700 hover:text-slate-900 hover:bg-black/5",
                          ].join(" ")}
                        >
                          {active && (
                            <motion.span
                              layoutId="adminTabHighlight"
                              transition={{ duration: 0.15 }}
                              className={`absolute inset-0 rounded-xl shadow-xs ${
                                activeTheme.id === "yellow-fade"
                                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950"
                                  : "bg-gradient-to-r from-blue-600 to-indigo-600"
                              }`}
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
              <div className="flex items-center justify-center flex-1 min-w-0 overflow-x-auto no-scrollbar md:flex-wrap gap-1.5 text-sm font-semibold">
                {links.map((link) => (
                  <div key={link.href} className="relative group shrink-0">
                    <Link
                      href={link.href}
                      className={[
                        "flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all duration-150 font-bold text-xs",
                        isActive(link.href)
                          ? activeTheme.activePill
                          : activeTheme.inactivePill,
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

          {/* RIGHT ACTIONS: COMPACT THEME BUTTON & PROFILE */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            
            {/* 🎨 THEME SWITCHER BUTTON */}
            <button
              type="button"
              onClick={() => setThemeModalOpen(true)}
              className={`flex items-center justify-center rounded-xl transition cursor-pointer border shrink-0 ${
                activeTheme.isDarkHeader
                  ? "bg-white/15 hover:bg-white/25 text-white border-white/20"
                  : "bg-white hover:bg-slate-100 text-slate-900 border-slate-200 shadow-2xs"
              } h-7 w-7 sm:h-8 sm:w-auto sm:px-2.5 sm:py-1.5 text-xs font-bold gap-1.5`}
              title="Change CRM Color Theme"
            >
              <FaPalette className="text-xs sm:text-sm" />
              <span className="hidden sm:inline">{activeTheme.name.split(" ")[0]}</span>
              <span
                className={`h-2 w-2 rounded-full bg-gradient-to-r ${activeTheme.swatch} ring-1 ring-white/50 shrink-0 hidden sm:inline-block`}
              />
            </button>

            {/* Admin Custom Notification Trigger */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setNotifModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-950 px-2.5 py-1.5 rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer shrink-0"
                title="Send Custom Push Notification"
              >
                <FiBell className="text-sm animate-bounce" />
                <span>Push Alert</span>
              </button>
            )}

            {/* Profile Dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className={`flex items-center justify-center rounded-xl transition active:scale-95 cursor-pointer border shrink-0 ${
                  activeTheme.isDarkHeader
                    ? "bg-white/15 hover:bg-white/25 text-white border-white/20"
                    : "bg-white hover:bg-slate-100 text-slate-900 border-slate-200"
                } h-7 w-7 sm:h-8 sm:w-auto sm:px-2 sm:py-1.5 gap-1.5`}
              >
                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-white/20 ring-1 ring-white/30 grid place-items-center overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={me?.username || me?.name || "profile"}
                      className="h-full w-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <span className="text-[9px] sm:text-[10px] font-bold">
                      {initials(me?.displayName || me?.username || me?.name)}
                    </span>
                  )}
                </div>
                <span className="hidden md:block max-w-[90px] truncate text-xs font-bold">
                  {me?.displayName || me?.username || me?.name || "Profile"}
                </span>
              </button>

              {/* Profile Menu Popover */}
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl overflow-hidden z-[120] ring-1 ring-black/10 border border-slate-100 text-slate-900"
                    role="menu"
                  >
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        Signed in as
                      </p>
                      <p className="text-sm font-black text-slate-900 truncate">
                        {me?.displayName || me?.username || me?.name || "User"}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Role:{" "}
                        <span className="font-extrabold text-blue-600 capitalize">
                          {me?.role || "technician"}
                        </span>
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        setThemeModalOpen(true);
                      }}
                      className="flex items-center justify-between w-full px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition text-xs font-bold cursor-pointer"
                      role="menuitem"
                    >
                      <div className="flex items-center gap-2">
                        <FaPalette className="text-blue-600" />
                        <span>Theme: {activeTheme.name.split(" ")[0]}</span>
                      </div>
                      <span
                        className={`h-3 w-3 rounded-full bg-gradient-to-r ${activeTheme.swatch} border border-slate-300`}
                      />
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          setNotifModalOpen(true);
                        }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-amber-800 hover:bg-amber-50 transition text-xs font-bold cursor-pointer"
                        role="menuitem"
                      >
                        <FiBell aria-hidden="true" className="text-amber-600" />
                        <span>Send Push Alert</span>
                      </button>
                    )}

                    <Link
                      href={me?.role === "admin" ? "/admin" : "/tech/profile"}
                      className="flex items-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-blue-50 transition text-xs font-bold"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <FiUser aria-hidden="true" className="text-blue-600" />
                      <span>My Profile</span>
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50 transition text-xs font-bold border-t border-slate-100 cursor-pointer"
                      role="menuitem"
                    >
                      <FiLogOut aria-hidden="true" />
                      <span>Logout</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 🎨 THEME SWITCHER MODAL */}
      {/* ======================================================== */}
      <AnimatePresence>
        {themeModalOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-3 sm:p-4"
            onClick={() => setThemeModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-4 sm:p-5 max-h-[90vh] flex flex-col overflow-hidden text-slate-900 border border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white grid place-items-center text-base shadow-sm shadow-blue-500/30">
                    🎨
                  </div>
                  <div>
                    <h2 className="font-extrabold text-base text-slate-900">
                      Select Color Theme
                    </h2>
                    <p className="text-xs text-slate-500">
                      Choose your favorite header and app style
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setThemeModalOpen(false)}
                  className="text-slate-400 hover:text-slate-800 text-xl p-1 cursor-pointer transition"
                >
                  ✕
                </button>
              </div>

              {/* Themes Grid */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 py-1 min-h-0">
                {CRM_THEMES.map((th) => {
                  const isSelected = activeThemeId === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        changeTheme(th.id);
                        if (typeof navigator !== "undefined" && navigator.vibrate) {
                          navigator.vibrate([15]);
                        }
                      }}
                      className={`w-full p-3 rounded-2xl border text-left transition-all duration-150 flex items-center justify-between gap-3 select-none cursor-pointer ${
                        isSelected
                          ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                          : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-xl bg-gradient-to-tr ${th.swatch} shadow-xs shrink-0 flex items-center justify-center text-sm ring-1 ring-black/10`}
                        >
                          <span>{th.icon}</span>
                        </div>

                        <div className="min-w-0">
                          <div className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                            {th.name}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {th.category}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isSelected ? (
                          <div className="h-6 w-6 rounded-full bg-blue-600 text-white grid place-items-center text-xs font-black shadow-sm">
                            <FiCheck size={14} />
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-slate-300 bg-white" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Close Button */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setThemeModalOpen(false)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 📱 MOBILE NAVIGATION DRAWER */}
      {/* ======================================================== */}
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
              className={`fixed top-0 left-0 w-80 max-w-[85vw] h-full ${activeTheme.drawerBg} z-[110] p-5 flex flex-col shadow-2xl md:hidden overflow-y-auto`}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/20">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-xl grid place-items-center font-black text-xs ${activeTheme.badgeBg}`}>
                    <span>CS</span>
                  </div>
                  <span className="font-extrabold text-base">Chimney Solutions</span>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  className="text-2xl p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <FiX />
                </button>
              </div>

              {/* Theme Quick Switcher in Mobile Drawer */}
              <div className="mb-4 p-3 rounded-2xl bg-black/10 border border-white/15">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <FaPalette /> Color Theme:
                  </span>
                  <span className="text-[11px] font-extrabold opacity-80">
                    {activeTheme.name.split(" ")[0]}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {CRM_THEMES.map((th) => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        changeTheme(th.id);
                        if (typeof navigator !== "undefined" && navigator.vibrate) {
                          navigator.vibrate([15]);
                        }
                      }}
                      className={`h-7 w-7 rounded-full bg-gradient-to-tr ${th.swatch} border-2 shrink-0 transition-transform ${
                        activeThemeId === th.id
                          ? "scale-110 border-white ring-2 ring-blue-400"
                          : "border-white/30 opacity-70 hover:opacity-100"
                      }`}
                      title={th.name}
                    />
                  ))}
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setNotifModalOpen(true);
                  }}
                  className="mb-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-400 text-amber-950 font-bold text-sm shadow-md active:scale-95 transition cursor-pointer"
                >
                  <FiBell className="text-base" /> Send Push Notification
                </button>
              )}

              <p className="text-[11px] uppercase tracking-wider opacity-70 mb-2 font-bold">
                {me?.role === "admin" ? "Admin Navigation" : "Technician Navigation"}
              </p>

              <div className="space-y-1">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={[
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition",
                      isActive(link.href)
                        ? "bg-white/20 ring-1 ring-white/30 font-bold shadow-xs"
                        : "hover:bg-white/10 opacity-90",
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
                  className="flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-white text-sm font-bold transition shadow-lg cursor-pointer"
                >
                  <FiLogOut aria-hidden="true" /> Logout
                </button>
                <p className="text-[11px] opacity-70 mt-3 text-center">
                  Chimney Solutions CRM • v2.0
                </p>
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
