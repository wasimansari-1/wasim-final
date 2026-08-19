import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { getCache, setCache } from "../../../lib/redis.js";

function normalize(str = "") {
  return String(str).toLowerCase().replace(/\s+/g, " ").trim();
}

async function handler(req, res, user) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false });
  }

  try {
    const cacheKey = "admin:customer-payments:list";
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cachedData);
    }

    const db = await getDb();
    const callsColl = db.collection("forwarded_calls");
    const paymentsColl = db.collection("payments");

    // Fetch calls and payments in parallel
    const [calls, payments] = await Promise.all([
      callsColl.find({}).sort({ createdAt: -1 }).toArray(),
      paymentsColl.find({}).toArray(),
    ]);

    // Build payment match set
    const paidSet = new Set();
    for (const p of payments) {
      if (!Array.isArray(p.calls)) continue;
      for (const c of p.calls) {
        const key = [
          normalize(c.clientName),
          normalize(c.phone),
          normalize(c.address),
        ].join("|");
        paidSet.add(key);
      }
    }

    // Final customer list
    const result = calls.map((c) => {
      const key = [
        normalize(c.clientName),
        normalize(c.phone),
        normalize(c.address),
      ].join("|");

      const isPaid = paidSet.has(key);

      return {
        callId: String(c._id),
        clientName: c.clientName || "",
        phone: c.phone || "",
        address: c.address || "",
        price: c.price || 0,
        status: isPaid ? "Paid" : "Pending",
        createdAt: c.createdAt || "",
      };
    });

    const responsePayload = {
      success: true,
      total: result.length,
      paid: result.filter((x) => x.status === "Paid").length,
      pending: result.filter((x) => x.status === "Pending").length,
      customers: result,
    };

    await setCache(cacheKey, responsePayload, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(responsePayload);

  } catch (err) {
    console.error("CUSTOMER PAYMENTS ERROR:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

export default requireRole("admin")(handler);
