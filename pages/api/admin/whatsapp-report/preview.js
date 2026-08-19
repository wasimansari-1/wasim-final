// pages/api/admin/whatsapp-report/preview.js
import { requireRole, getDb } from "../../../../lib/api-helpers.js";
import { getDailyReportStats } from "../../../../lib/whatsapp-report-helper.js";

async function handler(req, res, user) {
  try {
    const db = await getDb();
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();

    const { stats, formattedMessage } = await getDailyReportStats(db, targetDate);

    return res.json({
      ok: true,
      success: true,
      stats,
      formattedMessage,
    });
  } catch (err) {
    console.error("Preview WhatsApp report error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default requireRole("admin")(handler);
