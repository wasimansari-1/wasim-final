import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import Papa from "papaparse";
import { getCache, setCache } from "../../../lib/redis.js";

async function handler(req, res, user) {
  try {
    let { techId = "", range = "today", from = "", to = "", csv = "" } = req.query;

    const cacheKey = `admin:payments:${techId}:${range}:${from}:${to}`;
    if (csv !== "1") {
      const cachedData = await getCache(cacheKey);
      if (cachedData) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cachedData);
      }
    }

    const db = await getDb();

    const match = {};

    // ---------------- FILTER BY TECHNICIAN ----------------
    if (techId && ObjectId.isValid(techId)) {
      match.techId = new ObjectId(techId);
    }

    // ---------------- DATE FILTERS ----------------
    const now = new Date();
    const start = new Date();

    if (range === "today") {
      start.setHours(0, 0, 0, 0);
      match.createdAt = { $gte: start };
    }

    if (range === "7") {
      match.createdAt = { $gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) };
    }

    if (range === "30") {
      match.createdAt = { $gte: new Date(now.getTime() - 30 * 24 * 3600 * 1000) };
    }

    if (range === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      match.createdAt = { $gte: first };
    }

    if (range === "lastmonth") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      match.createdAt = { $gte: first, $lte: last };
    }

    if (range === "year") {
      const first = new Date(now.getFullYear(), 0, 1);
      match.createdAt = { $gte: first };
    }

    if (range === "custom" && (from || to)) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from + "T00:00:00");
      if (to) match.createdAt.$lte = new Date(to + "T23:59:59");
    }

    // ---------------- FETCH PAYMENTS ----------------
    const items = await db
      .collection("payments")
      .find(match)
      .sort({ createdAt: -1 })
      .toArray();

    // ---------------- SUM TOTALS ----------------
    const sum = items.reduce(
      (acc, p) => {
        acc.online += Number(p.onlineAmount || 0);
        acc.cash += Number(p.cashAmount || 0);
        acc.total += Number(p.onlineAmount || 0) + Number(p.cashAmount || 0);
        return acc;
      },
      { online: 0, cash: 0, total: 0 }
    );

    // ---------------- CSV EXPORT ----------------
    if (csv === "1") {
      const flat = [];

      items.forEach((p) => {
        (p.calls || []).forEach((c) => {
          flat.push({
            Technician: p.techUsername,
            PayingName: p.receiver,
            Mode: p.mode,

            CallID: c.callId,
            ClientName: c.clientName,
            Phone: c.phone,
            Address: c.address,
            ServiceType: c.type,
            ServicePrice: c.price,

            Online: c.onlineAmount,
            Cash: c.cashAmount,

            TotalPayment: (c.onlineAmount || 0) + (c.cashAmount || 0),
            PaymentDate: new Date(p.createdAt).toLocaleString(),
          });
        });
      });

      const csvText = Papa.unparse(flat);
      return res.json({ csv: csvText });
    }

    // ---------------- RESPONSE ----------------
    const responsePayload = {
      items: items.map((x) => ({
        ...x,
        _id: x._id.toString(),
      })),
      sum,
    };

    if (csv !== "1") {
      await setCache(cacheKey, responsePayload, 60);
      res.setHeader("X-Cache", "MISS");
    }

    return res.json(responsePayload);
  } catch (err) {
    console.error("PAYMENT API ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server Error" });
  }
}

export default requireRole("admin")(handler);
