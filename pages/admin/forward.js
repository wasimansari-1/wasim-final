"use client";

import Header from "../../components/Header";
import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import toast from "react-hot-toast";
import { FiPhoneForwarded, FiSend, FiUser, FiPhone, FiMapPin, FiDollarSign, FiClock, FiFileText, FiTag } from "react-icons/fi";

const forwardSound = typeof window !== "undefined"
  ? new Audio("/forward.mp3")
  : null;

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
        return;
      }

      // Play Sound
      try {
        if (forwardSound) {
          forwardSound.currentTime = 0;
          forwardSound.play().catch(() => {});
        }
      } catch {}

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

          toast.success("Call assigned & push notification sent 🔔⚡");

          // Reset Form
          clientNameRef.current.value = "";
          phoneRef.current.value = "";
          addressRef.current.value = "";
          priceRef.current.value = "";
          typeRef.current.value = "";
          timeZoneRef.current.value = "";
          notesRef.current.value = "";
          techRef.current.value = "";
          chooseRef.current.value = "";
        } catch (err) {
          console.error(err);
          toast.error("Network error");
        }
      });
    },
    []
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white grid place-items-center shadow-md shadow-blue-500/20 text-xl">
              <FiPhoneForwarded />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                New Call Assignment
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Forward client service request and notify technician instantly via push.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client Name */}
              <div>
                <label className="label flex items-center gap-1"><FiUser /> Client Name *</label>
                <input
                  ref={clientNameRef}
                  className="input"
                  placeholder="Enter client name"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="label flex items-center gap-1"><FiPhone /> Phone Number *</label>
                <input
                  ref={phoneRef}
                  type="tel"
                  className="input"
                  placeholder="e.g. 9876543210"
                  required
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="label flex items-center gap-1"><FiMapPin /> Client Address *</label>
              <textarea
                ref={addressRef}
                className="input min-h-[70px] resize-none"
                placeholder="Full address with landmark..."
                rows={2}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Price */}
              <div>
                <label className="label flex items-center gap-1"><FiDollarSign /> Service Price (₹) *</label>
                <input
                  ref={priceRef}
                  className="input"
                  placeholder="e.g. 500"
                  type="number"
                  min="0"
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label className="label flex items-center gap-1"><FiTag /> Service Type *</label>
                <input
                  ref={typeRef}
                  className="input"
                  placeholder="e.g. Chimney / Hob / Cleaning"
                  required
                />
              </div>

              {/* Time Zone */}
              <div>
                <label className="label flex items-center gap-1"><FiClock /> Preferred Time</label>
                <input
                  ref={timeZoneRef}
                  className="input"
                  placeholder="e.g. Morning / 2-4 PM"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Choose Call */}
              <div>
                <label className="label flex items-center gap-1"><FiTag /> Brand / Call Source *</label>
                <select
                  ref={chooseRef}
                  className="input bg-white"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    -- Select Source --
                  </option>
                  <option value="CHIMNEY_SOLUTIONS">CHIMNEY SOLUTIONS (WhatsApp Enabled)</option>
                  <option value="TKS">TKS</option>
                </select>
              </div>

              {/* Technician */}
              <div>
                <label className="label flex items-center gap-1"><FiUser /> Assign Technician *</label>
                <select
                  ref={techRef}
                  className="input bg-white"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Technician --</option>
                  {techs.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.username || t.name} {t.phone ? `(${t.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="label flex items-center gap-1"><FiFileText /> Special Notes</label>
              <textarea
                ref={notesRef}
                className="input min-h-[60px] resize-none"
                placeholder="Any special customer instructions..."
                rows={2}
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/25 transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 text-base mt-2"
            >
              {loading ? (
                <span className="inline-block border-2 w-5 h-5 rounded-full border-white border-t-transparent animate-spin" />
              ) : (
                <FiSend className="text-lg" />
              )}
              <span>{loading ? "Forwarding & Notifying Technician..." : "Assign Call & Push Notify Technician"}</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
