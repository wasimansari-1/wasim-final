// pages/api/admin/whatsapp-report/send.js
import { requireRole, getDb } from "../../../../lib/api-helpers.js";
import { getDailyReportStats, sendWhatsAppMessageDirect } from "../../../../lib/whatsapp-report-helper.js";

async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const db = await getDb();
    const { phone, isTest = false, sendToAllConfigured = false } = req.body || {};

    // 1. Get live report data and message
    const { stats, formattedMessage } = await getDailyReportStats(db);

    let targetRecipients = [];

    if (sendToAllConfigured) {
      const settings = await db.collection("whatsapp_report_settings").findOne({ key: "daily_8pm_report" });
      const rawList = Array.isArray(settings?.recipients) ? settings.recipients : [];

      targetRecipients = rawList
        .slice(0, 4) // Strictly maximum 4 numbers
        .map((r, i) => {
          if (typeof r === "object" && r !== null) {
            return {
              phone: String(r.phone || "").replace(/[^0-9]/g, ""),
              label: r.label || `Recipient ${i + 1}`,
              active: r.active !== false,
            };
          }
          return {
            phone: String(r || "").replace(/[^0-9]/g, ""),
            label: `Recipient ${i + 1}`,
            active: true,
          };
        })
        .filter((r) => r.phone.length >= 10 && r.active);
    } else if (phone) {
      const clean = String(phone).replace(/[^0-9]/g, "");
      if (clean.length < 10) {
        return res.status(400).json({ ok: false, message: "Invalid phone number provided" });
      }
      targetRecipients = [{ phone: clean, label: "Direct Recipient", active: true }];
    } else {
      return res.status(400).json({ ok: false, message: "No recipient phone number specified" });
    }

    if (targetRecipients.length === 0) {
      return res.status(400).json({ ok: false, message: "No active recipient numbers found in configuration." });
    }

    const results = [];

    for (const rec of targetRecipients) {
      const num = rec.phone;
      const dispatchResult = await sendWhatsAppMessageDirect(num, formattedMessage, stats);

      // Log into database
      await db.collection("whatsapp_report_logs").insertOne({
        phone: num,
        label: rec.label || "Recipient",
        status: dispatchResult.success ? "sent" : "failed",
        error: dispatchResult.error || null,
        apiResult: dispatchResult.result || null,
        isSender: dispatchResult.isSender || false,
        message: formattedMessage,
        stats,
        dateFormatted: stats.dateFormatted,
        type: isTest ? "test" : sendToAllConfigured ? "manual_broadcast_4" : "manual",
        triggeredBy: user?.username || "admin",
        createdAt: new Date(),
      });

      results.push({
        phone: num,
        label: rec.label,
        success: dispatchResult.success,
        waLink: dispatchResult.waLink,
        note: dispatchResult.note || null,
      });
    }

    const successfulCount = results.filter((r) => r.success).length;

    return res.json({
      ok: true,
      success: true,
      message: `WhatsApp Report dispatched to ${successfulCount} of ${results.length} recipient(s).`,
      results,
      stats,
    });
  } catch (err) {
    console.error("Send WhatsApp Report error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default requireRole("admin")(handler);
