"use client";

import Header from "../../components/Header";
import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import toast from "react-hot-toast";
import {
  FiPhoneForwarded,
  FiSend,
  FiUser,
  FiPhone,
  FiMapPin,
  FiDollarSign,
  FiClock,
  FiFileText,
  FiTag,
  FiCheckCircle,
} from "react-icons/fi";
import { MdVerified } from "react-icons/md";

const forwardSound =
  typeof window !== "undefined" ? new Audio("/forward.mp3") : null;

const vibrate = (pattern = [50, 30, 50]) => {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
};

export default function Forward() {
  const [user, setUser] = useState(null);
  const [techs, setTechs] = useState([]);
  const [loading, startTransition] = useTransition();

  // FORM refs
  const clientNameRef = useRef();
  const phoneRef = useRef();
  const addressRef = useRef();
  const priceRef = useRef();
  const typeRef = useRef();
  const timeZoneRef = useRef();
  const notesRef = useRef();
  const techRef = useRef();
  const chooseRef = useRef();

  useEffect(() => {
    (async () => {
      try {
        const [meRes, techRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/admin/techs"),
        ]);

        if (!meRes.ok) throw new Error("User fetch failed");
        const me = await meRes.json();

        if (me.role !== "admin") {
          toast.error("Unauthorized.");
          return (window.location.href = "/login");
        }

        setUser(me);

        const techData = await techRes.json();
        setTechs(techData.items || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load technician list");
      }
    })();
  }, []);

  const submit = useCallback(
    async (e) => {
      e.preventDefault();

      const payload = {
        clientName: clientNameRef.current.value.trim(),
        phone: phoneRef.current.value.trim(),
        address: addressRef.current.value.trim(),
        price: priceRef.current.value.trim(),
        type: typeRef.current.value.trim(),
        timeZone: timeZoneRef.current.value.trim(),
        notes: notesRef.current.value.trim(),
        techId: techRef.current.value,
        chooseCall: chooseRef.current.value,
      };

      if (
        !payload.clientName ||
        !payload.phone ||
        !payload.address ||
        !payload.techId ||
        !payload.chooseCall
      ) {
        toast.error("Please fill all required fields");
        vibrate([100]);
        return;
      }

      // Play Sound
      try {
        if (forwardSound) {
          forwardSound.currentTime = 0;
          forwardSound.play().catch(() => {});
        }
      } catch {}

      vibrate([40, 20, 40]);

      startTransition(async () => {
        try {
          const r = await fetch("/api/admin/forward", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const d = await r.json().catch(() => ({}));

          if (!r.ok) {
            toast.error(d.error || "Forward failed");
            return;
          }

          toast.success("🎉 Call assigned & push notification sent!");
          vibrate([60]);

          // Reset Form
          if (clientNameRef.current) clientNameRef.current.value = "";
          if (phoneRef.current) phoneRef.current.value = "";
          if (addressRef.current) addressRef.current.value = "";
          if (priceRef.current) priceRef.current.value = "";
          if (typeRef.current) typeRef.current.value = "";
          if (timeZoneRef.current) timeZoneRef.current.value = "";
          if (notesRef.current) notesRef.current.value = "";
          if (techRef.current) techRef.current.value = "";
          if (chooseRef.current) chooseRef.current.value = "";
        } catch (err) {
          console.error(err);
          toast.error("Network error");
        }
      });
    },
    []
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans antialiased text-slate-800 safe-bottom">
      <Header user={user} />

      <main className="max-w-2xl mx-auto px-3 sm:px-6 py-4 space-y-3.5">
        {/* COMPACT & SLEEK ASSIGNMENT CARD */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
          {/* Header Strip */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-blue-600 text-white grid place-items-center shadow-md shadow-blue-500/20 text-lg shrink-0">
                <FiPhoneForwarded />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight truncate">
                    Assign Call to Technician
                  </h1>
                  <MdVerified className="text-blue-600 text-sm shrink-0" />
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate">
                  Direct assignment with instant mobile push notification ⚡
                </p>
              </div>
            </div>
          </div>

          {/* LINE-BY-LINE PROFESSIONAL FORM */}
          <form onSubmit={submit} className="space-y-3">
            {/* LINE 1: Client Name & Phone Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Client Name */}
              <div className="space-y-1">
                <label className="text-[11px] sm:text-xs font-bold text-slate-700 flex items-center gap-1">
                  <FiUser className="text-blue-600 text-xs" /> Client Name <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={clientNameRef}
                  className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition"
                  placeholder="Full name"
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-[11px] sm:text-xs font-bold text-slate-700 flex items-center gap-1">
                  <FiPhone className="text-emerald-600 text-xs" /> Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={phoneRef}
                  type="tel"
                  className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition"
                  placeholder="Phone number"
                  required
                />
              </div>
            </div>

            {/* LINE 2: Client Address */}
            <div className="space-y-1">
              <label className="text-[11px] sm:text-xs font-bold text-slate-700 flex items-center gap-1">
                <FiMapPin className="text-rose-600 text-xs" /> Client Address <span className="text-rose-500">*</span>
              </label>
              <textarea
                ref={addressRef}
                className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition resize-none"
                placeholder="Enter address..."
                rows={2}
                required
              />
            </div>

            {/* LINE 3: Price, Service Type & Preferred Time */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {/* Price */}
              <div className="space-y-1">
                <label className="text-[10px] sm:text-xs font-bold text-slate-700 flex items-center gap-0.5 truncate">
                  <FiDollarSign className="text-emerald-600 text-xs shrink-0" /> Price (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={priceRef}
                  className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/90 rounded-xl px-2.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition font-semibold"
                  placeholder="Price"
                  type="number"
                  min="0"
                  required
                />
              </div>

              {/* Type */}
              <div className="space-y-1">
                <label className="text-[10px] sm:text-xs font-bold text-slate-700 flex items-center gap-0.5 truncate">
                  <FiTag className="text-blue-600 text-xs shrink-0" /> Type <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={typeRef}
                  className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/90 rounded-xl px-2.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition"
                  placeholder="Service type"
                  required
                />
              </div>

              {/* Time Slot */}
              <div className="space-y-1">
                <label className="text-[10px] sm:text-xs font-bold text-slate-700 flex items-center gap-0.5 truncate">
                  <FiClock className="text-purple-600 text-xs shrink-0" /> Slot
                </label>
                <input
                  ref={timeZoneRef}
                  className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/90 rounded-xl px-2.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition"
                  placeholder="Time slot"
                />
              </div>
            </div>

            {/* LINE 4: Brand Source & Assign Technician */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Brand Source */}
              <div className="space-y-1">
                <label className="text-[11px] sm:text-xs font-bold text-slate-700 flex items-center gap-1">
                  <FiTag className="text-indigo-600 text-xs" /> Brand / Source <span className="text-rose-500">*</span>
                </label>
                <select
                  ref={chooseRef}
                  className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition font-semibold cursor-pointer"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    -- Select Source --
                  </option>
                  <option value="CHIMNEY_SOLUTIONS">CHIMNEY SOLUTIONS</option>
                  <option value="TKS">TKS</option>
                </select>
              </div>

              {/* Technician */}
              <div className="space-y-1">
                <label className="text-[11px] sm:text-xs font-bold text-slate-700 flex items-center gap-1">
                  <FiUser className="text-blue-600 text-xs" /> Assign Technician <span className="text-rose-500">*</span>
                </label>
                <select
                  ref={techRef}
                  className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition font-semibold cursor-pointer"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    -- Select Technician --
                  </option>
                  {techs.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.username || t.name} {t.phone ? `(${t.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* LINE 5: Special Notes */}
            <div className="space-y-1">
              <label className="text-[11px] sm:text-xs font-bold text-slate-700 flex items-center gap-1">
                <FiFileText className="text-slate-500 text-xs" /> Special Notes
              </label>
              <textarea
                ref={notesRef}
                className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition resize-none"
                placeholder="Optional notes..."
                rows={2}
              />
            </div>

            {/* LINE 6: SUBMIT ACTION BUTTON */}
            <div className="pt-1.5">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] text-white font-bold py-2.5 sm:py-3 rounded-2xl shadow-md shadow-blue-500/25 transition disabled:opacity-60 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
              >
                {loading ? (
                  <span className="inline-block border-2 w-4 h-4 rounded-full border-white border-t-transparent animate-spin" />
                ) : (
                  <FiSend className="text-sm" />
                )}
                <span>
                  {loading
                    ? "Assigning & Sending Notification..."
                    : "Assign Call & Push Notify Technician"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
