import { ObjectId } from "mongodb";
import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { delPattern } from "../../../lib/redis.js";
import { syncFirestoreCall } from "../../../lib/firebaseAdmin.js";

function safeParseBody(body) {
  try { return typeof body === "string" ? JSON.parse(body) : body; } catch { return body; }
}

export default requireRole("admin")(async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = await getDb();
    const { id } = safeParseBody(req.body) || {};

    if (!id) return res.status(400).json({ error: "Call ID required" });

    let callObjId = null;
    if (ObjectId.isValid(id)) {
      callObjId = new ObjectId(id);
    }

    // ⭐ Find call in forwarded_calls
    const call = await db.collection("forwarded_calls").findOne({
      $or: [{ _id: callObjId }, { _id: String(id) }].filter(Boolean),
    });

    if (!call)
      return res.status(404).json({ error: "Call not found in forwarded_calls" });

    // ⭐ 1. Delete call from forwarded_calls
    await db.collection("forwarded_calls").deleteOne({
      _id: call._id,
    });

    // ⭐ 2. Remove call from ALL technicians assignedCalls arrays
    await db.collection("technicians").updateMany(
      {},
      {
        $pull: {
          assignedCalls: { $in: [String(id), callObjId, call._id, String(call._id)].filter(Boolean) },
        },
      }
    ).catch(() => {});

    // ⭐ 3. Clean up associated notifications
    await db.collection("notifications").deleteMany({
      $or: [
        { callId: String(id) },
        { "data.forwardedCallId": String(id) },
        { callId: String(call._id) },
        { "data.forwardedCallId": String(call._id) },
      ],
    }).catch(() => {});

    // ⭐ 3.5 Broadcast delete to Firestore for real-time live removal on technician phones
    syncFirestoreCall(call._id || id, {}, "delete").catch(() => {});

    // ⭐ 4. Invalidate ALL Redis caches system-wide
    await Promise.all([
      delPattern("admin:calls:*").catch(() => {}),
      delPattern("tech:calls:*").catch(() => {}),
      delPattern("admin:summary:*").catch(() => {}),
      delPattern("admin:technician-calls:*").catch(() => {}),
      delPattern("admin:customer-payments:*").catch(() => {}),
      delPattern("admin:payments:*").catch(() => {}),
      delPattern("admin:forms:*").catch(() => {}),
      delPattern("tech:payment-check:*").catch(() => {}),
    ]);

    return res.status(200).json({ success: true, message: "Call permanently deleted from all collections" });

  } catch (err) {
    console.error("❌ DELETE CALL ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
