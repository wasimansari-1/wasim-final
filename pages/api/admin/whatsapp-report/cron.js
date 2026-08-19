// pages/api/admin/whatsapp-report/cron.js
import { getDb } from "../../../../lib/api-helpers.js";
import { getDailyReportStats, sendWhatsAppMessageDirect } from "../../../../lib/whatsapp-report-helper.js";

/**
 * Scheduled Cron Job Endpoint (called automatically at 8:00 PM / 20:00 IST daily)
 */
export default async function handler(req, res) {
  try {
    const db = await getDb();

    // 1. Check if autoSend is enabled
    const settings = await db.collection("whatsapp_report_settings").findOne({ key: "daily_8pm_report" });

    if (settings && settings.autoSend === false) {
      return res.json({ ok: true, message: "Automatic 8:00 PM WhatsApp report is disabled in settings." });
    }

    const recipients = Array.isArray(settings?.recipients) && settings.recipients.length > 0
      ? settings.recipients
      : ["8700994288"];

    // 2. Fetch today's aggregated stats and formatted text
    const { stats, formattedMessage } = await getDailyReportStats(db);

    const results = [];

    // 3. Dispatch to each configured recipient
    for (const num of recipients) {
      const dispatchResult = await sendWhatsAppMessageDirect(num, formattedMessage);

      // Record log
      await db.collection("whatsapp_report_logs").insertOne({
        phone: num,
        status: dispatchResult.success ? "sent" : "failed",
        error: dispatchResult.error || null,
        apiResult: dispatchResult.result || null,
        message: formattedMessage,
        stats,
        dateFormatted: stats.dateFormatted,
        type: "automated_cron_8pm",
        triggeredBy: "system_cron",
        createdAt: new Date(),
      });

      results.push({ phone: num, success: dispatchResult.success });
    }

    return res.json({
      ok: true,
      success: true,
      message: `Automatic 8:00 PM WhatsApp report dispatched to ${results.length} recipient(s).`,
      results,
    });
  } catch (err) {
    console.error("Cron WhatsApp dispatch error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
