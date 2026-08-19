// pages/api/admin/whatsapp-report/cron.js
import { getDb } from "../../../../lib/api-helpers.js";
import { getDailyReportStats, sendWhatsAppMessageDirect } from "../../../../lib/whatsapp-report-helper.js";

/**
 * Scheduled Cron Job Endpoint (called automatically at configured schedule time IST daily)
 */
export default async function handler(req, res) {
  try {
    const db = await getDb();

    // 1. Check if autoSend is enabled
    const settings = await db.collection("whatsapp_report_settings").findOne({ key: "daily_8pm_report" });

    if (settings && settings.autoSend === false) {
      return res.json({ ok: true, message: "Automatic WhatsApp daily report is currently disabled in settings." });
    }

    const rawList = Array.isArray(settings?.recipients) ? settings.recipients : [];
    const activeRecipients = rawList
      .slice(0, 4) // Strictly maximum 4 numbers
      .map((r, i) => {
        if (typeof r === "object" && r !== null) {
          return {
            phone: String(r.phone || "").replace(/[^0-9]/g, ""),
            label: r.label || `Recipient ${i + 1}`,
            time: r.time || settings?.sendTime || "20:00",
            active: r.active !== false,
          };
        }
        return {
          phone: String(r || "").replace(/[^0-9]/g, ""),
          label: `Recipient ${i + 1}`,
          time: settings?.sendTime || "20:00",
          active: true,
        };
      })
      .filter((r) => r.phone.length >= 10 && r.active);

    const recipientsToDispatch = activeRecipients.length > 0
      ? activeRecipients
      : [{ phone: "8700994288", label: "Admin Default", active: true }];

    // 2. Fetch today's aggregated stats and formatted text
    const { stats, formattedMessage } = await getDailyReportStats(db);

    const results = [];

    // 3. Dispatch to each configured active recipient (up to 4)
    for (const rec of recipientsToDispatch) {
      const dispatchResult = await sendWhatsAppMessageDirect(rec.phone, formattedMessage, stats);

      // Record log
      await db.collection("whatsapp_report_logs").insertOne({
        phone: rec.phone,
        label: rec.label,
        status: dispatchResult.success ? "sent" : "failed",
        error: dispatchResult.error || null,
        apiResult: dispatchResult.result || null,
        message: formattedMessage,
        stats,
        dateFormatted: stats.dateFormatted,
        type: "automated_cron_daily",
        triggeredBy: "system_cron",
        createdAt: new Date(),
      });

      results.push({ phone: rec.phone, label: rec.label, success: dispatchResult.success });
    }

    return res.json({
      ok: true,
      success: true,
      message: `Automatic daily WhatsApp report dispatched to ${results.length} configured recipient(s).`,
      results,
    });
  } catch (err) {
    console.error("Cron WhatsApp dispatch error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
