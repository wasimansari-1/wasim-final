import { getDb, requireRole } from "../../../lib/api-helpers";
import { getCache, setCache } from "../../../lib/redis";

async function handler(req, res) {
  try {
    const cacheKey = "admin:calls:all";
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cachedData);
    }

    const db = await getDb();

    const data = await db
      .collection("forwarded_calls")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const totalCount = data.length;

    const result = data.map((x, idx) => ({
      ...x,
      _id: x._id.toString(),
      srNo: totalCount - idx,
    }));

    await setCache(cacheKey, result, 60);
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(result);

  } catch (err) {
    console.error("Download Error:", err);
    return res.status(500).json({
      success: false,
      error: "Something went wrong",
    });
  }
}

export default requireRole("admin")(handler);
