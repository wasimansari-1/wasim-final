import Link from "next/link";
import { useRouter } from "next/router";
import { FiHome, FiPhoneCall, FiCreditCard, FiUser } from "react-icons/fi";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function BottomNav() {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Check pending calls count for badge
    (async () => {
      try {
        const res = await fetch("/api/tech/my-calls?tab=Pending&pageSize=1");
        const data = await res.json().catch(() => null);
        const count = data?.counts?.pending ?? data?.totalCount ?? data?.total ?? 0;
        setPendingCount(count);
      } catch (e) {}
    })();
  }, [router.pathname]);

  const items = [
    { href: "/tech", label: "Service Form", icon: <FiHome size={20} /> },
    {
      href: "/tech/calls",
      label: "My Calls",
      icon: <FiPhoneCall size={20} />,
      badge: pendingCount > 0 ? pendingCount : null,
    },
    { href: "/tech/payments", label: "Payments", icon: <FiCreditCard size={20} /> },
    { href: "/tech/profile", label: "Profile", icon: <FiUser size={20} /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/90 backdrop-blur-2xl border-t border-slate-200/80 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] px-2 pt-2 pb-[calc(10px+env(safe-area-inset-bottom,12px))]">
      <div className="grid grid-cols-4 items-center">
        {items.map((it) => {
          const isActive = router.pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              prefetch={true}
              className="relative flex flex-col items-center justify-center py-1 group select-none"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-blue-50 rounded-2xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}

              <div
                className={`relative flex items-center justify-center transition-transform duration-200 ${
                  isActive ? "text-blue-600 scale-110" : "text-slate-500 group-hover:text-slate-800"
                }`}
              >
                {it.icon}

                {it.badge && (
                  <span className="absolute -top-1.5 -right-2.5 h-4 min-w-[16px] px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full grid place-items-center shadow-sm animate-pulse">
                    {it.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[11px] mt-1 font-bold tracking-tight transition-colors duration-150 ${
                  isActive ? "text-blue-600" : "text-slate-500"
                }`}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
