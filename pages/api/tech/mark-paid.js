// pages/api/tech/mark-paid.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { delPattern } from "../../../lib/redis.js";

async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { callId } = req.body || {};
    if (!callId) {
      return res.status(400).json({ success: false, error: "callId is required" });
    }

    const db = await getDb();

    // Check if admin has enabled direct mark paid in settings
    const settingsDoc = await db.collection("system_settings").findOne({ key: "general_settings" });
    if (user.role !== "admin" && !settingsDoc?.allowDirectMarkPaid) {
      return res.status(403).json({ success: false, error: "Direct Mark as Paid is disabled by Admin in Settings." });
    }

    const forwardedColl = db.collection("forwarded_calls");

    const query = {};
    if (ObjectId.isValid(callId)) {
      query.$or = [{ _id: new ObjectId(callId) }, { _id: callId }];
    } else {
      query._id = callId;
    }

    const updateRes = await forwardedColl.updateOne(query, {
      $set: {
        paymentStatus: "Paid",
        isPaid: true,
        markedPaidAt: new Date(),
        markedPaidBy: user.username || user.name || user.id,
      },
    });

    if (updateRes.matchedCount === 0) {
      return res.status(404).json({ success: false, error: "Call not found" });
    }

    // Invalidate Redis caches so changes reflect immediately
    try {
      await delPattern("tech:calls:*");
      await delPattern("admin:calls:*");
      await delPattern("admin:customer-payments:*");
    } catch {}

    return res.status(200).json({ success: true, message: "Call marked as paid in database" });
  } catch (err) {
    console.error("Mark paid error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

export default requireRole("technician")(handler);
