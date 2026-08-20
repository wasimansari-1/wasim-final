"use client";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useMemo,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  FiUser,
  FiMapPin,
  FiCamera,
  FiX,
  FiCheck,
} from "react-icons/fi";
import {
  FaPhoneAlt,
  FaMoneyBillWave,
  FaWrench,
  FaTools,
  FaCheckDouble,
  FaHourglassHalf,
} from "react-icons/fa";

// 🔊 SUCCESS SOUND (forward.mp3)
const successSound =
  typeof window !== "undefined" ? new Audio("/forward.mp3") : null;

function playSuccessSound() {
  try {
    if (!successSound) return;
    successSound.currentTime = 0;
    successSound.play().catch(() => {});
  } catch {}
}

const vibrate = (pattern = [50, 30, 50]) => {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {}
};

function getInitials(name) {
  if (!name) return "CS";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// 4 Service Status Options
const SERVICE_STATUS_OPTIONS = [
  {
    id: "Service Done",
    label: "Service Done",
    icon: FaWrench,
    activeClass: "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white border-emerald-500 shadow-md shadow-emerald-500/25",
    inactiveClass: "bg-white hover:bg-emerald-50/70 text-slate-700 border-slate-200 hover:border-emerald-300",
  },
  {
    id: "Installation Done",
    label: "Installation Done",
    icon: FaTools,
    activeClass: "bg-gradient-to-tr from-blue-600 to-indigo-500 text-white border-blue-500 shadow-md shadow-blue-500/25",
    inactiveClass: "bg-white hover:bg-blue-50/70 text-slate-700 border-slate-200 hover:border-blue-300",
  },
  {
    id: "Complaint Done",
    label: "Complaint Done",
    icon: FaCheckDouble,
    activeClass: "bg-gradient-to-tr from-purple-600 to-indigo-500 text-white border-purple-500 shadow-md shadow-purple-500/25",
    inactiveClass: "bg-white hover:bg-purple-50/70 text-slate-700 border-slate-200 hover:border-purple-300",
  },
  {
    id: "Under Process",
    label: "Under Process",
    icon: FaHourglassHalf,
    activeClass: "bg-gradient-to-tr from-amber-500 to-orange-500 text-white border-amber-500 shadow-md shadow-amber-500/25",
    inactiveClass: "bg-white hover:bg-amber-50/70 text-slate-700 border-slate-200 hover:border-amber-300",
  },
];

export default function TechHome() {
  const [user, setUser] = useState(null);
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    clientName: "",
    address: "",
    payment: "",
    phone: "",
    status: "Service Done",
    signature: "",
    stickerUrl: "",
    callId: "",
  });

  const sigRef = useRef(null);
  const sigContainerRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(300);

  // Sticker upload states
  const fileInputRef = useRef(null);
  const [stickerPreview, setStickerPreview] = useState(null);
  const [stickerUploading, setStickerUploading] = useState(false);
  const [stickerUploadProgress, setStickerUploadProgress] = useState(0);
  const [stickerUploadedUrl, setStickerUploadedUrl] = useState("");

  // Customer Call Selection Modal states
  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callSearch, setCallSearch] = useState("");
  const [selectedCall, setSelectedCall] = useState(null);
  const [modalTab, setModalTab] = useState("all");

  // Duplicate submission guard
  const [lastSubmittedFingerprint, setLastSubmittedFingerprint] = useState("");

  // Happy success overlay
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // Responsive SignaturePad Canvas measurement (guarantees 0 overflow)
  useEffect(() => {
    const updateSize = () => {
      if (sigContainerRef.current) {
        const w =
          sigContainerRef.current.clientWidth ||
          sigContainerRef.current.getBoundingClientRect().width;
        if (w > 0) {
          setCanvasWidth(Math.floor(w));
          return;
        }
      }
      const fallback = typeof window !== "undefined" ? Math.min(window.innerWidth - 32, 480) : 300;
      setCanvasWidth(fallback > 0 ? fallback : 300);
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    let ro = null;
    if (typeof ResizeObserver !== "undefined" && sigContainerRef.current) {
      ro = new ResizeObserver(() => updateSize());
      ro.observe(sigContainerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateSize);
      if (ro) ro.disconnect();
    };
  }, [loading]);

  // Patch SignaturePad touch handling
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      const pad =
        sigRef.current?.getSignaturePad?.() ||
        sigRef.current?._sigPad ||
        sigRef.current;
      const canvas =
        sigRef.current?.getCanvas?.() ||
        pad?._canvas ||
        sigRef.current?._canvas;

      if (pad && pad._handleTouchMove) {
        const origTouchMove = pad._handleTouchMove;
        const origTouchStart = pad._handleTouchStart;
        const origTouchEnd = pad._handleTouchEnd;

        pad._handleTouchMove = function (e) {
          if (e && e.cancelable) e.preventDefault();
          const touch = e?.targetTouches?.[0];
          if (touch && typeof pad._strokeMoveUpdate === "function") {
            pad._strokeMoveUpdate(touch);
          }
        };

        if (origTouchStart) {
          pad._handleTouchStart = function (e) {
            if (e && e.cancelable) e.preventDefault();
            if (e?.targetTouches?.length === 1) {
              const touch = e.changedTouches[0];
              if (touch && typeof pad._strokeBegin === "function") {
                pad._strokeBegin(touch);
              }
            }
          };
        }

        if (origTouchEnd) {
          pad._handleTouchEnd = function (e) {
            if (e && e.cancelable) e.preventDefault();
            if (typeof pad._strokeEnd === "function") {
              pad._strokeEnd(e);
            }
          };
        }

        if (canvas) {
          canvas.style.touchAction = "none";
          try {
            canvas.removeEventListener("touchmove", origTouchMove);
            canvas.removeEventListener("touchstart", origTouchStart);
            canvas.removeEventListener("touchend", origTouchEnd);
            canvas.addEventListener("touchstart", pad._handleTouchStart, { passive: false });
            canvas.addEventListener("touchmove", pad._handleTouchMove, { passive: false });
            canvas.addEventListener("touchend", pad._handleTouchEnd, { passive: false });
          } catch {}
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [loading]);

  // Load Calls for Technician
  const loadCalls = useCallback(async () => {
    try {
      setCallsLoading(true);
      const params = new URLSearchParams({
        tab: "All Calls",
        page: "1",
        pageSize: "100",
      });
      const r = await fetch("/api/tech/my-calls?" + params.toString(), {
        cache: "no-store",
      });
      const d = await r.json();
      if (d?.success && Array.isArray(d.items)) {
        const mapped = d.items.map((i) => ({
          _id: i._id || i.id || "",
          clientName: i.clientName ?? i.customerName ?? i.name ?? i.fullName ?? "",
          phone: i.phone ?? "",
          address: i.address ?? "",
          type: i.type ?? "",
          price: i.price ?? 0,
          status: i.status ?? "Pending",
          createdAt: i.createdAt ?? "",
          timeZone: i.timeZone ?? "",
          notes: i.notes ?? "",
        }));
        setCalls(mapped);
      }
    } catch (err) {
      console.error("Calls load error:", err);
    } finally {
      setCallsLoading(false);
    }
  }, []);

  // Auth + initial load
  useEffect(() => {
    (async () => {
      try {
        const [meRes, callsRes] = await Promise.all([
          fetch("/api/auth/me").catch(() => null),
          fetch("/api/tech/my-calls?tab=All%20Calls&page=1&pageSize=100").catch(() => null),
        ]);

        if (!meRes || !meRes.ok) {
          window.location.href = "/login";
          return;
        }
        const u = await meRes.json();
        if (u.role !== "technician") {
          window.location.href = "/login";
          return;
        }

        startTransition(() => {
          setUser(u);
          setLoading(false);
        });

        if (callsRes && callsRes.ok) {
          const d = await callsRes.json().catch(() => ({ items: [] }));
          if (d?.success && Array.isArray(d.items)) {
            const mapped = d.items.map((i) => ({
              _id: i._id || i.id || "",
              clientName: i.clientName ?? i.customerName ?? i.name ?? i.fullName ?? "",
              phone: i.phone ?? "",
              address: i.address ?? "",
              type: i.type ?? "",
              price: i.price ?? 0,
              status: i.status ?? "Pending",
              createdAt: i.createdAt ?? "",
              timeZone: i.timeZone ?? "",
              notes: i.notes ?? "",
            }));
            setCalls(mapped);
          }
        }
      } catch {
        window.location.href = "/login";
      }
    })();
  }, []);

  const clearSig = useCallback(() => {
    sigRef.current?.clear();
    setForm((prev) => ({ ...prev, signature: "" }));
  }, []);

  const handleSelectCustomerCall = useCallback((call) => {
    if (!call) return;
    vibrate([25]);

    startTransition(() => {
      setSelectedCall(call);
      setForm((prev) => ({
        ...prev,
        clientName: call.clientName || "",
        address: call.address || "",
        phone: call.phone || "",
        payment: call.price !== undefined && call.price !== null ? String(call.price) : "",
        callId: call._id || "",
      }));
      setCallModalOpen(false);
    });

    toast.success(`✓ Auto-filled: ${call.clientName || "Customer"}`, {
      id: "customer-autofill",
      icon: "📋",
    });
  }, []);

  const handleClearSelectedCustomer = useCallback(() => {
    setSelectedCall(null);
    setForm((prev) => ({
      ...prev,
      clientName: "",
      address: "",
      phone: "",
      payment: "",
      callId: "",
    }));
    vibrate([15]);
    toast("Customer selection cleared", { icon: "🧹" });
  }, []);

  // Compression helper
  async function compressImageFileToTarget(file, targetBytes = 6 * 1024) {
    if (!file) throw new Error("No file");

    const createImage = (blob) =>
      new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = (e) => rej(e);
        img.src = URL.createObjectURL(blob);
      });

    const img = await createImage(file);

    const canvasToBlob = (canvas, quality) =>
      new Promise((resolve) => {
        const mime = "image/webp";
        canvas.toBlob(resolve, mime, quality);
      });

    let width = Math.min(1000, img.width);
    let height = Math.round((img.height / img.width) * width);
    if (!width || !height) {
      width = 600;
      height = 400;
    }

    let quality = 0.85;
    let lastBlob = null;

    for (let pass = 0; pass < 14; pass++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(48, Math.round(width));
      canvas.height = Math.max(48, Math.round(height));
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas, quality);
      if (!blob) throw new Error("Compression failed");

      lastBlob = blob;
      if (blob.size <= targetBytes) return blob;

      if (quality > 0.12) {
        quality = Math.max(0.05, quality - 0.12);
      } else {
        width = Math.max(48, Math.round(width * 0.75));
        height = Math.max(48, Math.round((img.height / img.width) * width));
        quality = 0.6;
      }
    }

    return lastBlob;
  }

  const blobToDataURL = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });

  // Sticker upload
  async function handleFileInputChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    try {
      setStickerUploading(true);
      setStickerUploadProgress(10);
      vibrate([20]);

      const previewReader = new FileReader();
      previewReader.onload = () => setStickerPreview(previewReader.result);
      previewReader.readAsDataURL(f);

      const targetBytes = 6 * 1024;
      const compressedBlob = await compressImageFileToTarget(f, targetBytes);

      setStickerUploadProgress(40);
      const dataUrl = await blobToDataURL(compressedBlob);

      setStickerUploadProgress(65);

      const res = await fetch("/api/tech/upload-sticker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl, targetKB: 6 }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      if (!data?.success || !data.url) throw new Error("Upload did not return URL");

      setStickerUploadProgress(100);
      setStickerUploadedUrl(data.url);
      setForm((p) => ({ ...p, stickerUrl: data.url }));
      vibrate([40, 30, 40]);
      toast.success(`Sticker uploaded (${Math.round(data.sizeKB || 0)} KB)`);
    } catch (err) {
      console.error("Sticker upload err:", err);
      toast.error(err.message || "Sticker upload failed");
    } finally {
      setStickerUploading(false);
      setTimeout(() => setStickerUploadProgress(0), 600);
    }
  }

  function openCameraForSticker() {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = null;
    fileInputRef.current.click();
  }

  // Submit form
  async function submit(e) {
    e.preventDefault();

    if (!form.clientName.trim() || !form.phone.trim() || !form.address.trim()) {
      toast.error("Please enter customer name, phone, and address");
      vibrate([80]);
      return;
    }

    if (!form.stickerUrl) {
      toast.error("📸 Sticker photo is required before submitting");
      vibrate([80]);
      return;
    }

    let sigData = form.signature;
    try {
      if (sigRef.current && !sigRef.current.isEmpty()) {
        sigData = sigRef.current.toDataURL();
      }
    } catch {}

    const fingerprintObj = {
      clientName: form.clientName.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      payment: String(form.payment || ""),
      status: form.status,
      callId: form.callId || "",
    };
    const fingerprint = JSON.stringify(fingerprintObj);

    if (lastSubmittedFingerprint && lastSubmittedFingerprint === fingerprint) {
      toast("This form was already submitted!", { icon: "ℹ️" });
      return;
    }

    try {
      setSubmitting(true);
      vibrate([40, 20, 40]);

      const payload = {
        ...form,
        signature: sigData,
        stickerUrl: form.stickerUrl,
        callId: form.callId || null,
      };

      const r = await fetch("/api/tech/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const d = await r.json().catch(() => ({}));
      if (!r.ok || (!d.ok && !d.success)) {
        toast.error(d.message || d.error || "Failed to submit service form");
        return;
      }

      playSuccessSound();
      toast.success("✅ Service form submitted successfully!");
      setLastSubmittedFingerprint(fingerprint);

      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 1600);

      // Reset form
      setForm({
        clientName: "",
        address: "",
        payment: "",
        phone: "",
        status: "Service Done",
        signature: "",
        stickerUrl: "",
        callId: "",
      });
      setSelectedCall(null);
      clearSig();
      setStickerPreview(null);
      setStickerUploadedUrl("");

      await loadCalls();
    } catch (err) {
      console.error("Form submit error:", err);
      toast.error("Error submitting service form");
    } finally {
      setSubmitting(false);
    }
  }

  // Filtered Calls for Modal
  const filteredCalls = useMemo(() => {
    let list = calls.filter((c) => String(c.status || "").toLowerCase() !== "canceled");

    if (modalTab === "pending") {
      list = list.filter((c) => {
        const s = String(c.status || "").toLowerCase();
        return s === "pending" || s === "in process";
      });
    }

    if (!callSearch.trim()) return list;
    const q = callSearch.toLowerCase().trim();
    return list.filter(
      (c) =>
        (c.clientName || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.address || "").toLowerCase().includes(q) ||
        (c.type || "").toLowerCase().includes(q)
    );
  }, [calls, callSearch, modalTab]);

  return (
    <div className="min-h-screen bg-slate-50 safe-bottom overflow-x-hidden w-full max-w-full">
      <Header user={user} />

      <main className="w-full max-w-2xl mx-auto px-2.5 sm:px-6 py-2.5 sm:py-6 space-y-3.5">
        {/* Main Card */}
        <div className="w-full max-w-full bg-white rounded-3xl p-3 sm:p-6 shadow-sm border border-slate-200/80 space-y-4 overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center gap-2.5 sm:gap-3 pb-3 border-b border-slate-100 w-full">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white grid place-items-center text-lg sm:text-xl shadow-md shadow-blue-500/20 shrink-0">
              📝
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-lg font-black text-slate-900 leading-tight">
                  Technician Service Form
                </h1>
                <span className="bg-blue-50 text-blue-700 text-[9px] sm:text-[10px] font-black px-2 py-0.2 rounded-full border border-blue-200 uppercase tracking-wider shrink-0">
                  Live
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-snug mt-0.5">
                Choose customer call to auto-fill details, complete service & record sticker/signature.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="grid gap-3.5 w-full">
            
            {/* ======================================================== */}
            {/* 1) STEP 1: CHOOSE CUSTOMER (AUTO-FILL ALL FIELDS) */}
            {/* ======================================================== */}
            <div className="space-y-1.5 w-full">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="h-4.5 w-4.5 rounded-full bg-blue-600 text-white text-[10px] font-black grid place-items-center">
                    1
                  </span>
                  <span>Choose Customer (Auto-Fill)</span>
                </label>

                {selectedCall && (
                  <button
                    type="button"
                    onClick={handleClearSelectedCustomer}
                    className="text-[11px] sm:text-xs text-rose-500 hover:text-rose-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <FiX size={12} />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {!selectedCall ? (
                /* Unselected State: Responsive Action Button */
                <button
                  type="button"
                  onClick={() => {
                    setCallSearch("");
                    setModalTab("all");
                    setCallModalOpen(true);
                  }}
                  className="w-full border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-2.5 sm:p-3.5 bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-slate-50 hover:bg-blue-50 flex items-center justify-between gap-2 text-left transition duration-150 active:scale-[0.99] cursor-pointer group shadow-2xs overflow-hidden"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-blue-600 text-white grid place-items-center text-base shadow-sm shadow-blue-500/30 shrink-0">
                      🔍
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-blue-700 transition truncate">
                        Tap to Choose Customer Call
                      </div>
                      <p className="text-[10.5px] sm:text-[11px] text-slate-500 truncate">
                        {calls.length > 0
                          ? `Select from ${calls.length} assigned call(s)`
                          : "Auto-fill all details from assigned call"}
                      </p>
                    </div>
                  </div>

                  <span className="bg-blue-600 group-hover:bg-blue-700 text-white text-[11px] sm:text-xs font-black px-2.5 sm:px-3 py-1.5 rounded-xl shadow-xs shrink-0 flex items-center gap-1 transition">
                    <span>Select Call</span>
                    <span className="text-[9px]">▾</span>
                  </span>
                </button>
              ) : (
                /* Selected State: Verified Customer Card */
                <div className="border border-emerald-300/80 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-slate-50/80 rounded-2xl p-2.5 sm:p-3.5 flex items-start justify-between gap-2 shadow-2xs w-full overflow-hidden">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white font-black grid place-items-center text-xs shrink-0 shadow-xs">
                      {getInitials(selectedCall.clientName)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs sm:text-sm text-slate-900 truncate">
                          {selectedCall.clientName || "Customer"}
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-full border border-emerald-300 shrink-0 flex items-center gap-0.5">
                          <FiCheck size={9} /> Auto-Filled
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-semibold truncate flex items-center gap-1">
                        <FaPhoneAlt size={9} className="text-slate-400 shrink-0" />
                        <span>{selectedCall.phone || "No phone"}</span>
                        {selectedCall.type && (
                          <span className="text-slate-400">• {selectedCall.type}</span>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-[10.5px] text-slate-500 line-clamp-1 flex items-center gap-1">
                        <FiMapPin size={9} className="text-slate-400 shrink-0" />
                        <span className="truncate">{selectedCall.address || "Address not provided"}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCallSearch("");
                      setCallModalOpen(true);
                    }}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold px-2 py-1 rounded-xl shrink-0 shadow-2xs transition cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* 2) STEP 2: SERVICE STATUS OPTIONS (2x2 RESPONSIVE GRID) */}
            {/* ======================================================== */}
            <div className="space-y-1.5 w-full pt-0.5">
              <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span className="h-4.5 w-4.5 rounded-full bg-blue-600 text-white text-[10px] font-black grid place-items-center">
                  2
                </span>
                <span>Service Outcome / Status</span>
              </label>

              {/* 4 Interactive Option Chips */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full">
                {SERVICE_STATUS_OPTIONS.map((opt) => {
                  const isSelected = form.status === opt.id;
                  const Icon = opt.icon;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setForm((p) => ({ ...p, status: opt.id }));
                        vibrate([15]);
                      }}
                      className={`relative min-w-0 flex items-center gap-2 p-2 sm:p-2.5 rounded-2xl border transition-all duration-150 active:scale-95 cursor-pointer text-left overflow-hidden ${
                        isSelected ? opt.activeClass : opt.inactiveClass
                      }`}
                    >
                      <div
                        className={`h-7 w-7 sm:h-8 sm:w-8 rounded-xl grid place-items-center shrink-0 text-xs sm:text-sm ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <Icon size={12} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-[11px] sm:text-xs leading-tight break-words">
                          {opt.label}
                        </div>
                        <div
                          className={`text-[9px] sm:text-[9.5px] font-semibold leading-none mt-0.5 truncate ${
                            isSelected ? "text-white/85" : "text-slate-400"
                          }`}
                        >
                          {isSelected ? "Selected ✓" : "Select"}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="h-3.5 w-3.5 rounded-full bg-white text-slate-900 grid place-items-center text-[9px] font-black shrink-0 shadow-xs">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ======================================================== */}
            {/* 3) STEP 3: CUSTOMER DETAILS (AUTO-FILLED + EDITABLE) */}
            {/* ======================================================== */}
            <div className="space-y-2.5 w-full pt-1 border-t border-slate-100">
              <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span className="h-4.5 w-4.5 rounded-full bg-blue-600 text-white text-[10px] font-black grid place-items-center">
                  3
                </span>
                <span>Customer & Payment Details</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                <div className="space-y-1 min-w-0">
                  <label className="text-[11px] sm:text-xs font-bold text-slate-600 flex items-center gap-1 truncate">
                    <FiUser size={11} className="text-blue-600 shrink-0" />
                    <span>Customer Name *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter customer name"
                    value={form.clientName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, clientName: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs sm:text-sm shadow-2xs transition"
                  />
                </div>

                <div className="space-y-1 min-w-0">
                  <label className="text-[11px] sm:text-xs font-bold text-slate-600 flex items-center gap-1 truncate">
                    <FaPhoneAlt size={10} className="text-blue-600 shrink-0" />
                    <span>Phone Number *</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs sm:text-sm shadow-2xs transition"
                  />
                </div>
              </div>

              <div className="space-y-1 w-full">
                <label className="text-[11px] sm:text-xs font-bold text-slate-600 flex items-center gap-1 truncate">
                  <FiMapPin size={11} className="text-blue-600 shrink-0" />
                  <span>Service Address *</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Street address, locality, house no..."
                  value={form.address}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, address: e.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 focus:bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs sm:text-sm shadow-2xs transition resize-none"
                />
              </div>

              <div className="space-y-1 w-full">
                <label className="text-[11px] sm:text-xs font-bold text-slate-600 flex items-center gap-1 truncate">
                  <FaMoneyBillWave size={11} className="text-emerald-600 shrink-0" />
                  <span>Service Charge / Payment (₹)</span>
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.payment}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, payment: e.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs sm:text-sm shadow-2xs transition"
                />
              </div>
            </div>

            {/* ======================================================== */}
            {/* 4) STEP 4: STICKER / SERVICE PROOF PHOTO */}
            {/* ======================================================== */}
            <div className="space-y-1.5 w-full pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="h-4.5 w-4.5 rounded-full bg-blue-600 text-white text-[10px] font-black grid place-items-center">
                    4
                  </span>
                  <span>Sticker Photo (Camera) *</span>
                </label>

                {stickerUploadedUrl && (
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200 flex items-center gap-1">
                    <FiCheck size={10} /> Uploaded
                  </span>
                )}
              </div>

              <div className="flex gap-2 items-center w-full">
                <button
                  type="button"
                  onClick={openCameraForSticker}
                  disabled={stickerUploading}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer disabled:opacity-60"
                >
                  <FiCamera size={14} />
                  <span className="truncate">
                    {stickerUploading
                      ? `Uploading... ${stickerUploadProgress}%`
                      : stickerUploadedUrl
                      ? "Change Sticker Photo"
                      : "Open Camera & Take Photo"}
                  </span>
                </button>

                {(stickerPreview || stickerUploadedUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStickerPreview(null);
                      setStickerUploadedUrl("");
                      setForm((p) => ({ ...p, stickerUrl: "" }));
                      vibrate([10]);
                    }}
                    className="px-2.5 py-2.5 border border-slate-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {stickerPreview && (
                <div className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-2xl border border-slate-200/80 w-full overflow-hidden">
                  <img
                    src={stickerPreview}
                    alt="Sticker preview"
                    className="w-14 h-14 object-cover rounded-xl border border-slate-200 shadow-xs shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="truncate">Photo Captured</span>
                      {stickerUploadedUrl && (
                        <span className="text-[9.5px] text-emerald-700 bg-emerald-100 font-extrabold px-1.5 rounded">
                          Ready ✓
                        </span>
                      )}
                    </div>
                    {stickerUploading ? (
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-200"
                          style={{ width: `${stickerUploadProgress}%` }}
                        />
                      </div>
                    ) : (
                      <p className="text-[10.5px] text-slate-500 truncate">
                        Compressed & ready for instant submission.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* 5) STEP 5: CLIENT SIGNATURE */}
            {/* ======================================================== */}
            <div className="space-y-1.5 w-full pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="h-4.5 w-4.5 rounded-full bg-blue-600 text-white text-[10px] font-black grid place-items-center">
                    5
                  </span>
                  <span>Customer Signature (Sign in box)</span>
                </label>

                <button
                  type="button"
                  onClick={clearSig}
                  className="text-[11px] sm:text-xs text-rose-500 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <div
                ref={sigContainerRef}
                className="w-full max-w-full border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white"
                style={{ touchAction: "none" }}
              >
                <SignaturePad
                  ref={sigRef}
                  canvasProps={{
                    width: canvasWidth,
                    height: 140,
                    className: "sigCanvas w-full max-w-full bg-white block",
                    style: {
                      width: "100%",
                      maxWidth: "100%",
                      height: "140px",
                      touchAction: "none",
                      display: "block",
                      boxSizing: "border-box",
                    },
                  }}
                />
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                Please ask customer to draw digital signature inside the box.
              </p>
            </div>

            {/* ======================================================== */}
            {/* 6) SUBMIT ACTION BUTTON */}
            {/* ======================================================== */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold py-3 rounded-2xl text-xs sm:text-sm shadow-md shadow-blue-500/25 active:scale-[0.98] transition duration-150 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 mt-1"
            >
              {submitting ? (
                <>
                  <span className="inline-block border-2 w-4 h-4 rounded-full border-white border-t-transparent animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span className="truncate">
                  Submit Service Form {selectedCall ? `(${selectedCall.clientName})` : ""}
                </span>
              )}
            </button>
          </form>
        </div>
      </main>

      <BottomNav />

      {/* ======================================================== */}
      {/* 🔵 CHOOSE CUSTOMER CALL MODAL */}
      {/* ======================================================== */}
      <AnimatePresence>
        {callModalOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4"
            onClick={() => setCallModalOpen(false)}
          >
            <motion.div
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-3.5 sm:p-4 max-h-[88vh] flex flex-col overflow-hidden"
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 mb-2 gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-extrabold text-base text-slate-900 truncate">
                    Choose Customer Call
                  </h2>
                  <p className="text-xs text-slate-500 truncate">
                    Select customer to auto-fill all form fields
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="rounded-xl bg-slate-100 p-0.5 text-xs flex gap-1">
                    <button
                      type="button"
                      onClick={() => setModalTab("all")}
                      className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                        modalTab === "all"
                          ? "bg-white text-blue-600 shadow-2xs"
                          : "text-slate-600"
                      }`}
                    >
                      All ({calls.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalTab("pending")}
                      className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                        modalTab === "pending"
                          ? "bg-white text-amber-600 shadow-2xs"
                          : "text-slate-600"
                      }`}
                    >
                      Pending
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCallModalOpen(false)}
                    className="text-gray-400 hover:text-black text-xl p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="relative mb-2 w-full">
                <input
                  className="w-full border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
                  placeholder="Search customer name, phone, address..."
                  value={callSearch}
                  onChange={(e) => setCallSearch(e.target.value || "")}
                />
                {callSearch && (
                  <button
                    type="button"
                    onClick={() => setCallSearch("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                  >
                    <FiX size={13} />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 py-1 min-h-0">
                {callsLoading && (
                  <div className="space-y-2 py-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="skeleton-shimmer h-16 rounded-2xl border border-slate-100" />
                    ))}
                  </div>
                )}

                {!callsLoading && filteredCalls.length === 0 && (
                  <div className="text-center text-slate-400 py-8 text-xs font-semibold space-y-1">
                    <div className="text-2xl">📋</div>
                    <div>No calls match your search.</div>
                  </div>
                )}

                {!callsLoading &&
                  filteredCalls.map((c) => {
                    const isSelected = selectedCall?._id === c._id;
                    const isClosed = String(c.status || "").toLowerCase() === "closed";

                    return (
                      <div
                        key={c._id}
                        onClick={() => handleSelectCustomerCall(c)}
                        className={`w-full rounded-2xl p-2.5 sm:p-3.5 border transition-all select-none flex items-start justify-between gap-2.5 cursor-pointer shadow-2xs ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20"
                            : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="h-9 w-9 rounded-xl bg-slate-900 text-white font-extrabold grid place-items-center text-xs shrink-0 shadow-2xs">
                            {getInitials(c.clientName)}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight truncate max-w-full">
                                {c.clientName || "Customer"}
                              </span>
                              {c.type && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded-md border border-blue-100 truncate max-w-[120px]">
                                  {c.type}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 font-semibold truncate flex items-center gap-1">
                              <FaPhoneAlt size={9} className="text-slate-400 shrink-0" />
                              <span className="truncate">{c.phone || "No phone"}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 line-clamp-1 flex items-center gap-1">
                              <FiMapPin size={10} className="text-slate-400 shrink-0" />
                              <span className="truncate">{c.address || "No address"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-xs sm:text-sm font-black text-slate-900">
                            ₹{c.price || 0}
                          </div>
                          <span
                            className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap inline-block ${
                              isClosed
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {c.status || "Pending"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCallModalOpen(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer text-center"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HAPPY SUCCESS OVERLAY */}
      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 180, damping: 15 }}
              className="relative bg-white rounded-3xl px-8 py-6 shadow-2xl text-center max-w-xs w-full overflow-hidden"
            >
              <div className="relative z-10 flex flex-col items-center gap-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, delay: 0.05 }}
                  className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg text-white text-3xl"
                >
                  ✓
                </motion.div>
                <div className="text-base font-semibold text-gray-900">
                  Service Form Saved
                </div>
                <div className="text-xs text-gray-600">
                  Client details, signature & sticker recorded successfully! ✨
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
