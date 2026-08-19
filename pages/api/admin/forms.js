import { requireRole, getDb } from "../../../lib/api-helpers.js";
import Papa from "papaparse";
import { getCache, setCache } from "../../../lib/redis.js";

/* -------------------------------------------------------
   🔍 MATCH FILTER BUILDER
------------------------------------------------------- */
function buildMatch({ q, status, tech, dateFrom, dateTo }) {
  const match = {};

  if (q) {
    const regex = new RegExp(q, "i");
    match.$or = [
      { clientName: regex },
      { phone: regex },
      { address: regex },
    ];
  }

  if (status) match.status = status;
  if (tech) match.techUsername = tech;

  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
    if (dateTo) match.createdAt.$lte = new Date(dateTo + "T23:59:59");
  }

  return match;
}

/* -------------------------------------------------------
   🔰 MAIN HANDLER
------------------------------------------------------- */
async function handler(req, res, user) {
  try {
    const {
      q = "",
      status = "",
      tech = "",
      dateFrom = "",
      dateTo = "",
      page = 1,
      csv,
    } = req.query;

    const cacheKey = `admin:forms:${q}:${status}:${tech}:${dateFrom}:${dateTo}:${page}`;

    if (csv !== "1") {
      const cachedData = await getCache(cacheKey);
      if (cachedData) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cachedData);
      }
    }

    const db = await getDb();
    const coll = db.collection("service_forms");
    const match = buildMatch({ q, status, tech, dateFrom, dateTo });

    /* -------------------------------------------------------
       📤 CSV EXPORT
    ------------------------------------------------------- */
    if (csv === "1") {
      const items = await coll
        .find(match)
        .sort({ createdAt: -1 })
        .toArray();

      const csvText = Papa.unparse(items, { fastMode: true });
      return res.status(200).json({ csv: csvText });
    }

    /* -------------------------------------------------------
       📥 PAGINATED LIST FETCH
    ------------------------------------------------------- */
    const limit = 20;
    const skip = (Number(page) - 1) * limit;

    const [items, total] = await Promise.all([
      coll
        .find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      coll.countDocuments(match),
    ]);

    const result = {
      items: items.map((x) => ({
        ...x,
        _id: x._id.toString(),
      })),
      total,
    };

    if (csv !== "1") {
      await setCache(cacheKey, result, 60);
      res.setHeader("X-Cache", "MISS");
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error("Forms API Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

export default requireRole("admin")(handler);
