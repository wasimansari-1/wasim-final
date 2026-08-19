import { ObjectId } from "mongodb";
import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { delPattern } from "../../../lib/redis.js";

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

    let callObjId;
    try { callObjId = new ObjectId(id); } catch { callObjId = null; }

    // ⭐ Always use the correct collection → forwarded_calls
    const call = await db.collection("forwarded_calls").findOne({
      _id: callObjId || id
    });

    if (!call)
      return res.status(404).json({ error: "Call not found in forwarded_calls" });

    // ⭐ Get technician
    const techId = call.techId || call.technicianId || null;

    // ⭐ Remove call from technician assignedCalls
    if (techId) {
      await db.collection("technicians").updateOne(
        { _id: new ObjectId(String(techId)) },
        { $pull: { assignedCalls: id } }
      );
    }

    // ⭐ Delete call
    await db.collection("forwarded_calls").deleteOne({
      _id: callObjId || id
    });

    // Invalidate Redis caches
    delPattern("tech:calls:*").catch(() => {});
    delPattern("admin:summary:*").catch(() => {});

    return res.status(200).json({ success: true, message: "Call deleted" });

  } catch (err) {
    console.error("❌ DELETE CALL ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
