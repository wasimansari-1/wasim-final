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
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

// 🔊 SUCCESS SOUND (same forward.mp3)
const successSound =
  typeof window !== "undefined" ? new Audio("/forward.mp3") : null;

function playSuccessSound() {
  try {
    if (!successSound) return;
    successSound.currentTime = 0;
    successSound.play().catch(() => {});
  } catch {}
}

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
    status: "Services Done",
    signature: "",
    stickerUrl: "", // will contain uploaded sticker URL returned from server
  });

  const [canvasWidth, setCanvasWidth] = useState(500);
  const sigRef = useRef();

  // sticker related states
  const fileInputRef = useRef();
  const [stickerPreview, setStickerPreview] = useState(null); // dataURL preview
  const [stickerUploading, setStickerUploading] = useState(false);
  const [stickerUploadProgress, setStickerUploadProgress] = useState(0);
  const [stickerUploadedUrl, setStickerUploadedUrl] = useState(""); // server URL

  // call modal states
  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callSearch, setCallSearch] = useState("");
  const [selectedCall, setSelectedCall] = useState(null);

  // submission duplication guard: fingerprint of last-submitted main fields
  const [lastSubmittedFingerprint, setLastSubmittedFingerprint] = useState("");

  // 🎉 Happy success overlay
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // Responsive canvas
  useEffect(() => {
    const updateSize = () => {
      setCanvasWidth(window.innerWidth < 500 ? window.innerWidth - 40 : 500);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Patch SignaturePad to fix Chrome/Safari touchmove intervention warning
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
          if (e && e.cancelable) {
            e.preventDefault();
          }
          const touch = e?.targetTouches?.[0];
          if (touch && typeof pad._strokeMoveUpdate === "function") {
            pad._strokeMoveUpdate(touch);
          }
        };

        if (origTouchStart) {
          pad._handleTouchStart = function (e) {
            if (e && e.cancelable) {
              e.preventDefault();
            }
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
            if (e && e.cancelable) {
              e.preventDefault();
            }
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

  // Calls loader
  const loadCalls = async () => {
    try {
      setCallsLoading(true);
      const params = new URLSearchParams({
        tab: "All Calls",
        page: "1",
        pageSize: "50",
      });
      const r = await fetch("/api/tech/my-calls?" + params.toString(), {
        cache: "no-store",
      });
      const d = await r.json();
      if (d?.success && Array.isArray(d.items)) {
        const mapped = d.items.map((i) => ({
          _id: i._id || i.id || "",
          clientName:
            i.clientName ?? i.customerName ?? i.name ?? i.fullName ?? "",
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
      } else {
        console.warn("No calls found");
      }
    } catch (err) {
      console.error("Calls load error:", err);
    } finally {
      setCallsLoading(false);
    }
  };

  // Auth + initial parallel load
  useEffect(() => {
    (async () => {
      try {
        const [meRes, callsRes] = await Promise.all([
          fetch("/api/auth/me").catch(() => null),
          fetch("/api/tech/my-calls?tab=All%20Calls&page=1&pageSize=50").catch(() => null),
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

  // Clear signature
  function clearSig() {
    sigRef.current?.clear();
    setForm((prev) => ({ ...prev, signature: "" }));
  }

  // Select call autofill
  function handleSelectCall(call) {
    if (!call) return;
    startTransition(() => {
      setSelectedCall(call);
      setForm((prev) => ({
        ...prev,
        clientName: call.clientName || "",
        address: call.address || "",
        phone: call.phone || "",
        payment: call.price ?? "",
      }));
      setCallModalOpen(false);
    });
  }

  // ===================== Compression helpers (client) =====================
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

    // progressive client-side passes to try to hit the tiny target before sending to server
    for (let pass = 0; pass < 14; pass++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(48, Math.round(width));
      canvas.height = Math.max(48, Math.round(height));
      const ctx = canvas.getContext("2d");
      // draw with slight smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas, quality);
      if (!blob) throw new Error("Compression failed");

      lastBlob = blob;
      if (blob.size <= targetBytes) return blob;

      // reduce quality / shrink further
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

  // ===================== Sticker upload (client -> server) =====================
  async function handleFileInputChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    try {
      setStickerUploading(true);
      setStickerUploadProgress(5);

      // quick preview
      const previewReader = new FileReader();
      previewReader.onload = () => setStickerPreview(previewReader.result);
      previewReader.readAsDataURL(f);

      // aggressive client-side attempt to reduce weight before server
      const targetBytes = 6 * 1024; // aim for ~6KB
      const compressedBlob = await compressImageFileToTarget(f, targetBytes);

      setStickerUploadProgress(30);
      try {
        // eslint-disable-next-line no-console
        console.log("Client compressed bytes:", compressedBlob.size);
      } catch {}

      // convert to base64
      const dataUrl = await blobToDataURL(compressedBlob);

      setStickerUploadProgress(50);

      // POST to server; pass targetKB to request extremely small final file
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
      toast.success(`Sticker uploaded (${Math.round((data.sizeKB || 0))} KB)`);
    } catch (err) {
      console.error("Sticker upload err:", err);
      toast.error(err.message || "Sticker upload failed");
    } finally {
      setStickerUploading(false);
      setTimeout(() => setStickerUploadProgress(0), 600);
    }
  }

  // trigger file input
  function openCameraForSticker() {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = null;
    fileInputRef.current.click();
  }

  // ===================== Submit form =====================
  async function submit(e) {
    e.preventDefault();

    // Require sticker uploaded
    if (!form.stickerUrl) {
      toast.error("Sticker upload required before submitting");
      return;
    }

    // generate fingerprint of main form fields to detect duplicate submit
    const fingerprintObj = {
      clientName: form.clientName?.trim() || "",
      address: form.address?.trim() || "",
      phone: form.phone?.trim() || "",
      payment: form.payment?.toString() || "",
    };
    const fingerprint = JSON.stringify(fingerprintObj);

    // if same as last submitted show toast and stop
    if (lastSubmittedFingerprint && lastSubmittedFingerprint === fingerprint) {
      toast("Already submitted", { icon: "ℹ️" });
      return;
    }

    try {
      setSubmitting(true);
      const signature = form.signature || sigRef.current?.toDataURL();
      const r = await fetch("/api/tech/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, signature, stickerUrl: form.stickerUrl }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed");
        return;
      }

      playSuccessSound();
      toast.success("Form submitted ✅");

      // Save fingerprint so duplicate can't be immediately re-submitted
      setLastSubmittedFingerprint(fingerprint);

      // show overlay
      setShowSuccessOverlay(true);
      setTimeout(() => {
        setShowSuccessOverlay(false);
      }, 1600);

      // reset UI form (keep lastSubmittedFingerprint)
      setForm({
        clientName: "",
        address: "",
        payment: "",
        phone: "",
        status: "Services Done",
        signature: "",
        stickerUrl: "",
      });
      setSelectedCall(null);
      clearSig();
      setStickerPreview(null);
      setStickerUploadedUrl("");
    } catch (err) {
      console.error(err);
      toast.error("Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Skeleton component
  const Skeleton = () => (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-6 bg-gray-200 rounded w-1/3"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-32 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-300 rounded w-1/2 mx-auto"></div>
    </div>
  );

  const filteredCalls = useMemo(() => {
    if (!callSearch.trim()) return calls;
    const q = callSearch.toLowerCase();
    return calls.filter(
      (c) =>
        (c.clientName || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q)
    );
  }, [calls, callSearch]);

  // ===================== UI =====================
  return (
    <div className="pb-16">
      <Header user={user} />

      <main className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="card shadow-md p-4 rounded-2xl border border-gray-100 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <div>📝</div>
            <div className="font-semibold text-lg">Service Form</div>
          </div>

          {loading ? (
            <Skeleton />
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              {/* select call */}
              <div className="space-y-1">
                <div className="text-sm font-semibold text-gray-700">
                  Select Call (Auto-fill)
                </div>

                <button
                  type="button"
                  onClick={() => setCallModalOpen(true)}
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 flex justify-between"
                >
                  <span className="truncate">
                    {selectedCall
                      ? `${selectedCall.clientName} (${selectedCall.phone})`
                      : "Choose from your assigned calls"}
                  </span>
                  <span className="text-gray-500 text-xs">▾</span>
                </button>
              </div>

              <input
                className="input border rounded-lg p-2"
                placeholder="Client Name"
                value={form.clientName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, clientName: e.target.value }))
                }
                required
              />

              <input
                className="input border rounded-lg p-2"
                placeholder="Client Address"
                value={form.address}
                onChange={(e) =>
                  setForm((p) => ({ ...p, address: e.target.value }))
                }
                required
              />

              <input
                className="input border rounded-lg p-2"
                type="number"
                placeholder="Payment (₹)"
                value={form.payment}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payment: e.target.value }))
                }
              />

              <input
                className="input border rounded-lg p-2"
                placeholder="Phone Number"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                required
              />

              <select
                className="input border rounded-lg p-2"
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, status: e.target.value }))
                }
              >
                <option>Services Done</option>
                <option>Installation Done</option>
                <option>Complaint Done</option>
                <option>Under Process</option>
              </select>

              {/* sticker upload */}
              <div>
                <div className="text-sm font-semibold mb-1">Sticker (Camera)</div>

                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={openCameraForSticker}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg"
                    disabled={stickerUploading}
                  >
                    {stickerUploading ? "Uploading..." : "Open Camera & Upload Sticker"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStickerPreview(null);
                      setStickerUploadedUrl("");
                      setForm((p) => ({ ...p, stickerUrl: "" }));
                    }}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    Clear
                  </button>
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
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">Preview</div>
                    <img
                      src={stickerPreview}
                      alt="sticker preview"
                      className="w-40 h-auto rounded-md border"
                    />
                    <div className="text-xs mt-1">
                      {stickerUploading && (
                        <div>Uploading... {stickerUploadProgress}%</div>
                      )}
                      {!stickerUploading && stickerUploadedUrl && (
                        <div className="text-green-600 text-xs">Uploaded</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* signature */}
              <div>
                <div className="text-sm font-semibold mb-1">Client Signature</div>
                <div className="border rounded-xl overflow-hidden bg-white shadow-sm" style={{ touchAction: "none" }}>
                  <SignaturePad
                    ref={sigRef}
                    canvasProps={{
                      width: canvasWidth,
                      height: 200,
                      className: "sigCanvas w-full bg-white",
                      style: { touchAction: "none" },
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Sign inside the box.
                  <button
                    type="button"
                    onClick={clearSig}
                    className="underline ml-2"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <button
                className="bg-blue-600 text-white font-semibold py-2 rounded-lg mt-2 active:scale-95 disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </form>
          )}
        </div>
      </main>

      <BottomNav />

      {/* Call modal */}
      <AnimatePresence>
        {callModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md bg-white rounded-2xl shadow-xl p-4 max-h-[80vh] flex flex-col"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex justify-between mb-3">
                <h2 className="font-semibold">Select Call</h2>
                <button
                  onClick={() => setCallModalOpen(false)}
                  className="text-gray-500 hover:text-black text-lg"
                >
                  ✕
                </button>
              </div>

              <input
                className="border rounded-lg px-3 py-2 mb-2 text-sm"
                placeholder="Search by name / phone / address"
                value={callSearch}
                onChange={(e) => setCallSearch(e.target.value)}
              />

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {callsLoading && (
                  <div className="space-y-2 py-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="skeleton-shimmer h-14 rounded-xl border border-slate-100" />
                    ))}
                  </div>
                )}

                {!callsLoading &&
                  filteredCalls.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => handleSelectCall(c)}
                      className="w-full border rounded-xl px-3 py-2 text-sm hover:bg-blue-50 text-left transition"
                    >
                      <div className="font-semibold">{c.clientName}</div>
                      <div className="text-xs text-gray-600">{c.phone}</div>
                      <div className="text-xs text-gray-500">{c.address}</div>
                      <div className="text-[11px] text-gray-400">
                        {c.type} • ₹{c.price}
                      </div>
                    </button>
                  ))}

                {!callsLoading && filteredCalls.length === 0 && (
                  <div className="text-center text-gray-500 py-4 text-sm">
                    No calls found.
                  </div>
                )}
              </div>

              <button
                onClick={() => setCallModalOpen(false)}
                className="mt-3 bg-gray-900 text-white py-2 rounded-xl text-sm"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success overlay */}
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
              <div className="pointer-events-none absolute -top-10 -left-10 h-24 w-24 bg-blue-100 rounded-full opacity-70" />
              <div className="pointer-events-none absolute -bottom-12 -right-6 h-28 w-28 bg-emerald-100 rounded-full opacity-70" />

              <div className="relative z-10 flex flex-col items-center gap-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, delay: 0.05 }}
                  className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"
                >
                  <span className="text-white text-3xl">✔</span>
                </motion.div>
                <div className="text-base font-semibold text-gray-900">
                  Service Saved Successfully
                </div>
                <div className="text-xs text-gray-600">
                  Client details, signature & sticker recorded. Great job! ✨
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
