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

    let targetPhones = [];

    if (sendToAllConfigured) {
      const settings = await db.collection("whatsapp_report_settings").findOne({ key: "daily_8pm_report" });
      targetPhones = Array.isArray(settings?.recipients) && settings.recipients.length > 0
        ? settings.recipients
        : [];
    } else if (phone) {
      const clean = String(phone).replace(/[^0-9]/g, "");
      if (clean.length < 10) {
        return res.status(400).json({ ok: false, message: "Invalid phone number provided" });
      }
      targetPhones = [clean];
    } else {
      return res.status(400).json({ ok: false, message: "No recipient phone number specified" });
    }

    const results = [];

    for (const num of targetPhones) {
      const dispatchResult = await sendWhatsAppMessageDirect(num, formattedMessage, stats);

      // Log into database
      await db.collection("whatsapp_report_logs").insertOne({
        phone: num,
        status: dispatchResult.success ? "sent" : "failed",
        error: dispatchResult.error || null,
        apiResult: dispatchResult.result || null,
        isSender: dispatchResult.isSender || false,
        message: formattedMessage,
        stats,
        dateFormatted: stats.dateFormatted,
        type: isTest ? "test" : "manual",
        triggeredBy: user?.username || "admin",
        createdAt: new Date(),
      });

      results.push({
        phone: num,
        success: dispatchResult.success,
        waLink: dispatchResult.waLink,
        note: dispatchResult.note || null,
      });
    }

    return res.json({
      ok: true,
      success: true,
      message: isTest
        ? `Test message processed for ${results.length} recipient(s)`
        : `Daily report dispatched to ${results.length} recipient(s)`,
      results,
      formattedMessage,
    });
  } catch (err) {
    console.error("Send WhatsApp report error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default requireRole("admin")(handler);
