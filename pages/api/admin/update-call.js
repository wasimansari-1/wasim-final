import { ObjectId } from "mongodb";
import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { delPattern } from "../../../lib/redis.js";

export default requireRole("admin")(async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = await getDb();

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const {
      _id,
      clientName,
      phone,
      address,
      notes,
      price,
      type,
      timeZone,
      techId,
    } = body;

    if (!_id) return res.status(400).json({ error: "Missing call ID" });

    const callId = new ObjectId(_id);

    // check in forwarded collection
    const existing = await db
      .collection("forwarded_calls")
      .findOne({ _id: callId });

    if (!existing)
      return res.status(404).json({ error: "Call not found in forwarded collection" });

    const updateDoc = {};

    if (clientName) updateDoc.clientName = clientName;
    if (phone) updateDoc.phone = phone;
    if (address) updateDoc.address = address;
    if (notes) updateDoc.notes = notes;
    if (price) updateDoc.price = price;
    if (type) updateDoc.type = type;
    if (timeZone) updateDoc.timeZone = timeZone;

    // TECH CHANGE
    if (techId) {
      updateDoc.techId = new ObjectId(techId);
    }

    await db.collection("forwarded_calls").updateOne(
      { _id: callId },
      { $set: updateDoc }
    );

    // Invalidate Redis caches
    delPattern("admin:calls:*").catch(() => {});
    delPattern("tech:calls:*").catch(() => {});
    delPattern("admin:summary:*").catch(() => {});

    return res.json({ success: true, message: "Call updated" });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
