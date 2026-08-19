// pages/api/tech/payment-check.js
import { ObjectId } from "mongodb";
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { getCache, setCache } from "../../../lib/redis.js";

/**
 * Returns:
 *  { success: true, paidCallIds: [...], paidKeys: [...] }
 *
 * paidCallIds = array of callId strings found in payments
 * paidKeys = array of normalized "name|phone|address" strings found in payments
 */
async function handler(req, res, user) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const cacheKey = `tech:payment-check:${user.id}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cachedData);
    }

    const db = await getDb();
    const forwardedColl = db.collection("forwarded_calls");
    const paymentsColl = db.collection("payments");

    // collect forwarded call ids for this technician (both string and ObjectId)
    const techIds = [user.id];
    if (ObjectId.isValid(user.id)) techIds.push(new ObjectId(user.id));

    const forwarded = await forwardedColl
      .find({ techId: { $in: techIds } })
      .project({ _id: 1 })
      .toArray();

    const forwardedCallIds = forwarded.map((f) => String(f._id));

    // Query payments related to this technician:
    // - payments explicitly saved with techId (best case)
    // - or payments that reference forwarded calls (via calls.callId)
    const paymentsCursor = paymentsColl.find({
      $or: [{ techId: { $in: techIds } }, { "calls.callId": { $in: forwardedCallIds } }],
    });

    const paidCallIdsSet = new Set();
    const paidKeySet = new Set();

    while (await paymentsCursor.hasNext()) {
      const pay = await paymentsCursor.next();
      if (!pay) continue;
      if (Array.isArray(pay.calls)) {
        for (const c of pay.calls) {
          if (!c) continue;
          if (c.callId) paidCallIdsSet.add(String(c.callId));

          const name = (c.clientName || c.name || "").toString().toLowerCase().trim();
          const phone = (c.phone || c.mobile || "").toString().replace(/\D/g, "");
          const address = (c.address || c.addr || c.location || "").toString().toLowerCase().trim();

          const key = `${name}|${phone}|${address}`;
          if (name || phone || address) paidKeySet.add(key);
        }
      }
    }

    const result = {
      success: true,
      paidCallIds: Array.from(paidCallIdsSet),
      paidKeys: Array.from(paidKeySet),
    };

    await setCache(cacheKey, result, 60);
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(result);
  } catch (err) {
    console.error("payment-check error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

export default requireRole("technician")(handler);
