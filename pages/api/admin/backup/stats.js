// pages/api/admin/backup/stats.js
import { requireRole, getDb } from "../../../../lib/api-helpers.js";

async function handler(req, res, user) {
  try {
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

    return res.json({
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
    });
  } catch (err) {
    console.error("Backup stats error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default requireRole("admin")(handler);
