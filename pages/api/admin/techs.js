import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { getCache, setCache } from "../../../lib/redis.js";

async function handler(req, res, user) {
  const cacheKey = "admin:techs:list";
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    res.setHeader("X-Cache", "HIT");
    return res.json(cachedData);
  }

  const db = await getDb();
  const items = await db.collection("technicians").find().sort({ createdAt: -1 }).toArray();
  const result = {
    items: items.map((x) => ({
      ...x,
      _id: x._id.toString(),
      password: x.plainPassword || x.password || null,
    })),
  };

  await setCache(cacheKey, result, 120);
  res.setHeader("X-Cache", "MISS");
  res.json(result);
}

export default requireRole("admin")(handler);
