import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { getCache, setCache } from "../../../lib/redis.js";

async function handler(req, res, user) {
  const cacheKey = "admin:summary:global";
  const cachedSummary = await getCache(cacheKey);
  if (cachedSummary) {
    res.setHeader("X-Cache", "HIT");
    return res.json(cachedSummary);
  }

  const db = await getDb();
  const [techs, forms, calls, paymentsAgg] = await Promise.all([
    db.collection("technicians").countDocuments(),
    db.collection("service_forms").countDocuments(),
    db.collection("forwarded_calls").countDocuments(),
    db.collection("payments").aggregate([
      { $group: { _id: null, total: { $sum: { $add: ["$onlineAmount", "$cashAmount"] } } } },
    ]).toArray(),
  ]);

  const result = {
    techs,
    forms,
    calls,
    totalPayments: paymentsAgg[0]?.total || 0,
  };

  await setCache(cacheKey, result, 60);
  res.setHeader("X-Cache", "MISS");
  res.json(result);
}

export default requireRole("admin")(handler);
