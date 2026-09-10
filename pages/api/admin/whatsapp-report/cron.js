// pages/api/admin/whatsapp-report/cron.js
import { checkAndDispatchScheduledReports, initWhatsAppScheduler, getISTDateInfo } from "../../../../lib/whatsapp-scheduler.js";

// Ensure scheduler is active
initWhatsAppScheduler();

/**
 * Scheduled Cron Job Endpoint
 * Accepts GET or POST
 * Query parameter `force=true` can be used to immediately dispatch to all active recipients without waiting for scheduled time.
 */
export default async function handler(req, res) {
  try {
    const force = req.query.force === "true" || req.body?.force === true;
    const result = await checkAndDispatchScheduledReports(force);
    const { currentHM, timeFormatted, dateFormatted } = getISTDateInfo();

    return res.json({
      ok: true,
      serverISTTime: `${dateFormatted} ${timeFormatted} (${currentHM})`,
      force,
      ...result,
    });
  } catch (err) {
    console.error("Cron WhatsApp dispatch error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
