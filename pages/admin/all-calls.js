"use client";

import { useEffect, useState } from "react";
import Header from "../../components/Header";
import { FiEdit, FiTrash, FiRepeat, FiSearch, FiX, FiCheckCircle, FiClock } from "react-icons/fi";
import toast from "react-hot-toast";
import { CallCardSkeleton } from "../../components/Skeleton";

/* -------------------------------------------------------------
   SAFE ID HELPER
------------------------------------------------------------- */
function getId(call) {
  if (!call) return null;
  if (typeof call._id === "string") return call._id;
  if (call._id?.$oid) return call._id.$oid;
  if (call._id?.toString) return call._id.toString();
  if (typeof call.id === "string") return call.id;
  return null;
}

export default function AllCalls() {
  const [calls, setCalls] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const [editData, setEditData] = useState(null);
  const [changeTechData, setChangeTechData] = useState(null);

  const [applying, setApplying] = useState(false);

  /* -------------------------------------------------------------
     LOAD DATA
  ------------------------------------------------------------- */
  const fetchData = async (opts = {}) => {
    try {
      setLoading(true);

      const finalPage = opts.page ?? page ?? 1;
      const finalQ = opts.q ?? q ?? "";
      const finalStatus = opts.status ?? status ?? "";

      const params = new URLSearchParams({
        page: String(finalPage),
        q: finalQ,
        status: finalStatus,
      });

      const [cRes, tRes] = await Promise.all([
        fetch("/api/admin/forwarded?" + params.toString(), {
          cache: "no-store",
        }),
        fetch("/api/admin/get-technicians", { cache: "no-store" }),
      ]);

      const cJson = await cRes.json();
      const tJson = await tRes.json();

      const items = Array.isArray(cJson)
        ? cJson
        : Array.isArray(cJson.items)
        ? cJson.items
        : [];

      const techList = Array.isArray(tJson?.data)
        ? tJson.data
        : Array.isArray(tJson?.techs)
        ? tJson.techs
        : [];

      setCalls(
        items.map((c) => ({
          ...c,
          _id: getId(c),
        }))
      );

      setTechs(
        techList.map((t) => ({
          _id: getId(t) || t._id?.toString?.() || t._id,
          name: t.name || t.username || "Unnamed Tech",
        }))
      );

      setPage(finalPage);
      setQ(finalQ);
      setStatus(finalStatus);
    } catch (err) {
      console.error("LOAD ERROR:", err);
      toast.error("Failed to load calls");
    } finally {
      setLoading(false);
      setApplying(false);
    }
  };

  useEffect(() => {
    fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------------------------------------
     DELETE CALL (OPTIMISTIC + INSTANT UI REMOVAL)
  ------------------------------------------------------------- */
  const deleteCall = async (id) => {
    if (!id) return;
    if (!confirm("Delete this call permanently?")) return;

    // 1. Instant optimistic UI removal
    setCalls((prev) => prev.filter((c) => getId(c) !== id));
    if (editData && getId(editData) === id) {
      setEditData(null);
    }

    try {
      const r = await fetch("/api/admin/delete-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Delete failed");
      toast.success("Call deleted permanently");
      fetchData({});
    } catch (err) {
      toast.error(err.message || "Failed to delete call");
      fetchData({});
    }
  };

  /* -------------------------------------------------------------
     SAVE EDIT
  ------------------------------------------------------------- */
  const saveEdit = async () => {
    if (!editData) return;
    const id = getId(editData);
    if (!id) return toast.error("Missing call ID");

    try {
      const r = await fetch("/api/admin/update-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editData, _id: id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Update failed");

      toast.success("Call updated successfully");
      setEditData(null);
      fetchData({});
    } catch (err) {
      toast.error(err.message);
    }
  };

  /* -------------------------------------------------------------
     CHANGE TECHNICIAN (OPTIMISTIC + INSTANT UI UPDATE)
  ------------------------------------------------------------- */
  const submitChangeTech = async () => {
    if (!changeTechData?.callId || !changeTechData?.newTech) {
      return toast.error("Please select a technician");
    }

    const { callId, newTech } = changeTechData;
    const targetTech = techs.find((t) => String(t._id) === String(newTech));

    // 1. Instant optimistic UI update
    if (targetTech) {
      setCalls((prev) =>
        prev.map((c) =>
          getId(c) === callId
            ? { ...c, techName: targetTech.name, techId: targetTech._id }
            : c
        )
      );
    }
    setChangeTechData(null);

    try {
      const r = await fetch("/api/admin/change-tech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, newTech }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Change tech failed");

      toast.success("Technician reassigned & notified 🔔");
      fetchData({});
    } catch (err) {
      toast.error(err.message || "Failed to reassign technician");
      fetchData({});
    }
  };

  /* -------------------------------------------------------------
     SKELETON
  ------------------------------------------------------------- */
  const Skeleton = () => (
    <div className="space-y-3 mt-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <CallCardSkeleton key={i} />
      ))}
    </div>
  );

  /* -------------------------------------------------------------
     BADGE FOR STATUS
  ------------------------------------------------------------- */
  const statusBadgeClass = (s) => {
    const v = (s || "").toLowerCase();
    if (v === "pending") return "bg-amber-100 text-amber-800 border-amber-200";
    if (v === "in process" || v === "in-progress")
      return "bg-blue-100 text-blue-800 border-blue-200";
    if (v === "completed" || v === "closed")
      return "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold";
    if (v === "canceled" || v === "cancelled")
      return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  return (
    <>
      <Header user={{ role: "admin", name: "Admin" }} />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* TITLE BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              All Calls
            </h1>
            <p className="text-sm text-gray-500">
              View, edit, assign and inspect status / closure audit of all forwarded calls.
            </p>
          </div>

          <div className="text-xs sm:text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium">
            ⚡ Push Notifications Active • Instant Sync
          </div>
        </div>

        {/* FILTERS BAR */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 sm:px-5 sm:py-4 flex flex-col md:flex-row gap-3 md:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-3 text-gray-400 text-sm" />
            <input
              className="input pl-9"
              placeholder="Search by client, phone, address, technician..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <select
            className="w-full md:w-44 input bg-white"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="Closed">Closed Calls</option>
            <option value="Pending">Pending</option>
            <option value="In Process">In Process</option>
            <option value="Completed">Completed</option>
            <option value="Canceled">Canceled</option>
          </select>

          {/* Apply button */}
          <button
            onClick={() => {
              setApplying(true);
              fetchData({ page: 1, q, status });
            }}
            className="w-full md:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition shadow-sm"
            disabled={applying}
          >
            {applying ? "Applying…" : "Apply Filter"}
          </button>
        </section>

        {/* LIST / SKELETON */}
        <section>
          {(loading || applying) && <Skeleton />}

          {!loading && !applying && calls.length === 0 && (
            <div className="mt-6 bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">
              No calls found. Try changing filters or search.
            </div>
          )}

          {!loading && !applying && calls.length > 0 && (
            <div className="mt-4 space-y-3">
              {calls.map((call) => {
                const id = getId(call);
                const isClosed = call.status === "Closed" || call.status === "Completed";
                const closedTime = call.closedAt || (isClosed ? call.updatedAt : null);

                return (
                  <div
                    key={id}
                    className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow px-4 py-4 sm:px-5 sm:py-4 flex flex-col gap-3 ${
                      isClosed ? "border-emerald-200/80 bg-emerald-50/10" : "border-gray-100"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                      {/* LEFT INFO */}
                      <div className="space-y-1 text-sm text-gray-800 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="font-bold text-base sm:text-lg text-gray-900">
                            {call.clientName || "Unknown Client"}
                          </p>
                          {call.status && (
                            <span
                              className={[
                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border font-semibold",
                                statusBadgeClass(call.status),
                              ].join(" ")}
                            >
                              {call.status}
                            </span>
                          )}
                        </div>

                        {call.phone && (
                          <p className="text-gray-600 text-xs sm:text-sm font-medium">
                            📱 {call.phone}
                          </p>
                        )}

                        {call.address && (
                          <p className="text-gray-700 text-xs sm:text-sm">
                            📍 {call.address}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mt-1">
                          {call.type && (
                            <span>
                              <b>Type:</b> {call.type}
                            </span>
                          )}
                          {call.price != null && call.price !== "" && (
                            <span>
                              <b>Price:</b> ₹{call.price}
                            </span>
                          )}
                          {call.timeZone && (
                            <span>
                              <b>Time Zone:</b> {call.timeZone}
                            </span>
                          )}
                        </div>

                        {call.notes && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            <b>Notes:</b> {call.notes}
                          </p>
                        )}

                        {/* Technician & Closure Audit Strip */}
                        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs border-t border-gray-100 mt-2">
                          <div>
                            Technician:{" "}
                            <span className="font-bold text-blue-600">
                              {call.techName || call.technician?.name || "Not Assigned"}
                            </span>
                          </div>

                          {isClosed && closedTime && (
                            <div className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-lg font-semibold">
                              <FiCheckCircle className="text-emerald-700" />
                              <span>Closed: {new Date(closedTime).toLocaleString("en-IN")}</span>
                              {call.closedByName && <span>by {call.closedByName}</span>}
                            </div>
                          )}

                          {call.createdAt && !isClosed && (
                            <span className="text-gray-400">
                              Created: {new Date(call.createdAt).toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* RIGHT ACTIONS */}
                      <div className="flex sm:flex-col gap-2 sm:items-stretch sm:justify-start text-sm">
                        <button
                          onClick={() =>
                            setEditData({
                              ...call,
                              _id: id,
                            })
                          }
                          className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition font-medium text-xs shadow-sm"
                        >
                          <FiEdit className="text-xs" /> Edit
                        </button>

                        <button
                          onClick={() =>
                            setChangeTechData({
                              callId: id,
                              newTech: "",
                            })
                          }
                          className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98] transition font-medium text-xs shadow-sm"
                        >
                          <FiRepeat className="text-xs" /> Reassign
                        </button>

                        <button
                          onClick={() => deleteCall(id)}
                          className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] transition font-medium text-xs shadow-sm"
                        >
                          <FiTrash className="text-xs" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* PAGINATION */}
        {!loading && calls.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between text-sm">
            <button
              className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 transition font-medium text-xs"
              disabled={page <= 1}
              onClick={() => fetchData({ page: page - 1 })}
            >
              ← Prev
            </button>

            <span className="text-gray-600 font-semibold text-xs sm:text-sm">
              Page <span className="text-gray-900">{page}</span>
            </span>

            <button
              className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition font-medium text-xs"
              onClick={() => fetchData({ page: page + 1 })}
            >
              Next →
            </button>
          </section>
        )}
      </main>

      {/* EDIT MODAL */}
      {editData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditData(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <FiX size={20} />
            </button>

            <h2 className="text-xl font-bold mb-3 text-gray-900">
              Edit Call Details
            </h2>

            <div className="space-y-2 text-sm">
              <div>
                <label className="label">Client Name</label>
                <input
                  className="input"
                  placeholder="Client Name"
                  value={editData.clientName || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, clientName: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="label">Phone Number</label>
                <input
                  className="input"
                  placeholder="Phone"
                  value={editData.phone || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, phone: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="label">Address</label>
                <textarea
                  className="input min-h-[60px]"
                  placeholder="Address"
                  value={editData.address || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, address: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Price (₹)</label>
                  <input
                    className="input"
                    placeholder="Price"
                    type="number"
                    value={editData.price ?? ""}
                    onChange={(e) =>
                      setEditData({ ...editData, price: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">Service Type</label>
                  <input
                    className="input"
                    placeholder="Type"
                    value={editData.type || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, type: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={editData.status || "Pending"}
                  onChange={(e) =>
                    setEditData({ ...editData, status: e.target.value })
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="In Process">In Process</option>
                  <option value="Completed">Completed</option>
                  <option value="Closed">Closed</option>
                  <option value="Canceled">Canceled</option>
                </select>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input min-h-[60px]"
                  placeholder="Notes"
                  value={editData.notes || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, notes: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="label">Assigned Technician</label>
                <select
                  className="input"
                  value={editData.techId || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, techId: e.target.value })
                  }
                >
                  <option value="">Keep Technician</option>
                  {techs.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const id = getId(editData);
                  if (id) {
                    deleteCall(id);
                  }
                }}
                className="px-4 py-3 rounded-xl text-sm font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FiTrash size={15} />
                <span>Delete</span>
              </button>

              <button
                onClick={saveEdit}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition shadow-md cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE TECH MODAL */}
      {changeTechData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 relative">
            <button
              onClick={() => setChangeTechData(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <FiX size={20} />
            </button>

            <h2 className="text-xl font-bold mb-3 text-gray-900">
              Reassign Technician
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              The new technician will receive an instant push notification on their phone.
            </p>

            <select
              className="input mb-4"
              value={changeTechData.newTech}
              onChange={(e) =>
                setChangeTechData({
                  ...changeTechData,
                  newTech: e.target.value,
                })
              }
            >
              <option value="">Select New Technician</option>
              {techs.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>

            <button
              disabled={!changeTechData.newTech}
              onClick={submitChangeTech}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
            >
              Update & Notify Technician 🔔
            </button>
          </div>
        </div>
      )}
    </>
  );
}
