// pages/api/admin/tech-summary.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { getCache, setCache } from "../../../lib/redis.js";

async function handler(req, res, user) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing technician id" });

  const cacheKey = `admin:summary:tech:${id}`;
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    res.setHeader("X-Cache", "HIT");
    return res.json(cachedData);
  }

  try {
    const db = await getDb();
    const payments = db.collection("payments");

    const techIds = [id];
    if (ObjectId.isValid(id)) techIds.push(new ObjectId(id));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [agg, todayAgg] = await Promise.all([
      payments.aggregate([
        { $match: { techId: { $in: techIds } } },
        {
          $group: {
            _id: null,
            online: { $sum: "$onlineAmount" },
            cash: { $sum: "$cashAmount" },
            total: { $sum: { $add: ["$onlineAmount", "$cashAmount"] } },
          },
        },
      ]).toArray(),
      payments.aggregate([
        { $match: { techId: { $in: techIds }, createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: { $add: ["$onlineAmount", "$cashAmount"] } } } },
      ]).toArray(),
    ]);

    const result = {
      online: agg[0]?.online || 0,
      cash: agg[0]?.cash || 0,
      total: agg[0]?.total || 0,
      today: todayAgg[0]?.total || 0,
    };

    await setCache(cacheKey, result, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(result);
  } catch (err) {
    console.error("tech-summary error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default requireRole("admin")(handler);
