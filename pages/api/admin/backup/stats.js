// pages/api/admin/backup/stats.js
import { requireRole, getDb } from "../../../../lib/api-helpers.js";
import { getCache, setCache } from "../../../../lib/redis.js";

async function handler(req, res, user) {
  try {
    const cacheKey = "admin:backup:stats";
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cachedData);
    }

    const db = await getDb();

    const [
      callsCount,
      paymentsCount,
      formsCount,
      techsCount,
      usersCount,
      whatsappLogsCount,
    ] = await Promise.all([
      db.collection("forwarded_calls").countDocuments(),
      db.collection("payments").countDocuments(),
      db.collection("service_forms").countDocuments(),
      db.collection("technicians").countDocuments(),
      db.collection("users").countDocuments(),
      db.collection("whatsapp_report_logs").countDocuments(),
    ]);

    const result = {
      ok: true,
      success: true,
      stats: {
        forwarded_calls: callsCount,
        payments: paymentsCount,
        service_forms: formsCount,
        technicians: techsCount,
        users: usersCount,
        whatsapp_report_logs: whatsappLogsCount,
        totalRecords:
          callsCount +
          paymentsCount +
          formsCount +
          techsCount +
          usersCount +
          whatsappLogsCount,
      },
      lastChecked: new Date(),
    };

    await setCache(cacheKey, result, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(result);
  } catch (err) {
    console.error("Backup stats error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default requireRole("admin")(handler);
