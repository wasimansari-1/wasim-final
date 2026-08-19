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

    const body = safeParseBody(req.body) || {};

    const {
      _id,
      id,
      clientName,
      phone,
      address,
      notes,
      price,
      type,
      timeZone,
      status,
      techId,
    } = body;

    const rawId = _id || id;
    if (!rawId) return res.status(400).json({ error: "Missing call ID" });

    let callObjectId = null;
    if (ObjectId.isValid(rawId)) {
      callObjectId = new ObjectId(rawId);
    }

    // Check in forwarded collection
    const existing = await db
      .collection("forwarded_calls")
      .findOne({ $or: [{ _id: callObjectId }, { _id: rawId }].filter(Boolean) });

    if (!existing)
      return res.status(404).json({ error: "Call not found in forwarded collection" });

    const updateDoc = {
      updatedAt: new Date(),
    };

    if (clientName !== undefined) updateDoc.clientName = String(clientName).trim();
    if (phone !== undefined) updateDoc.phone = String(phone).trim();
    if (address !== undefined) updateDoc.address = String(address).trim();
    if (notes !== undefined) updateDoc.notes = String(notes).trim();
    if (price !== undefined) updateDoc.price = Number(price) || 0;
    if (type !== undefined) updateDoc.type = String(type).trim();
    if (timeZone !== undefined) updateDoc.timeZone = String(timeZone).trim();
    if (status !== undefined) {
      updateDoc.status = String(status).trim();
      if (status === "Closed" || status === "Completed") {
        updateDoc.closedAt = new Date();
      }
    }

    // 🔄 TECH REASSIGNMENT
    if (techId && String(techId) !== String(existing.techId)) {
      let newTechObjectId = null;
      if (ObjectId.isValid(techId)) {
        newTechObjectId = new ObjectId(techId);
      }

      const newTech = await db.collection("technicians").findOne({
        $or: [{ _id: newTechObjectId }, { _id: String(techId) }, { username: String(techId) }].filter(Boolean),
      });

      if (newTech) {
        updateDoc.techId = newTech._id;
        updateDoc.techName = newTech.username || newTech.name || "Technician";

        // Remove from old technician's list
        if (existing.techId) {
          await db.collection("technicians").updateOne(
            { _id: existing.techId },
            { $pull: { assignedCalls: String(rawId) } }
          ).catch(() => {});
        }

        // Add to new technician's list
        await db.collection("technicians").updateOne(
          { _id: newTech._id },
          { $addToSet: { assignedCalls: String(rawId) } }
        ).catch(() => {});
      }
    }

    await db.collection("forwarded_calls").updateOne(
      { _id: existing._id },
      { $set: updateDoc }
    );

    // Sync to Firestore for real-time live push to technician devices
    syncFirestoreCall(existing._id, {
      ...existing,
      ...updateDoc,
      _id: String(existing._id),
    }).catch(() => {});

    // Invalidate all Redis caches across the entire system
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

    return res.json({ success: true, message: "Call updated across all collections" });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
