// pages/api/admin/forwarded.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { getCache, setCache } from "../../../lib/redis.js";

async function handler(req, res) {
  try {
    const {
      q = "",
      status = "",
      page = 1,
      limit = 20,
    } = req.query;

    const cacheKey = `admin:calls:${q}:${status}:${page}:${limit}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cachedData);
    }

    const db = await getDb();
    const match = {};

    // 🔍 SEARCH
    if (q) {
      match.$or = [
        { clientName: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
        { techName: { $regex: q, $options: "i" } },
      ];
    }

    // 🟦 STATUS FILTER
    if (status) match.status = status;

    const coll = db.collection("forwarded_calls");
    const skipCount = (Number(page) - 1) * Number(limit);

    // Parallel count & find slice
    const [total, items] = await Promise.all([
      coll.countDocuments(match),
      coll
        .find(match)
        .sort({ createdAt: -1 })
        .skip(skipCount)
        .limit(Number(limit))
        .toArray(),
    ]);

    const hasMore = Number(page) * Number(limit) < total;

    const result = {
      success: true,
      total,
      hasMore,
      items: items.map((x, idx) => ({
        ...x,
        _id: x._id.toString(),
        srNo: total - (skipCount + idx),
      })),
    };

    await setCache(cacheKey, result, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(result);

  } catch (err) {
    console.error("API ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

export default requireRole("admin")(handler);
