// pages/api/admin/whatsapp-report/get-settings.js
import { requireRole, getDb } from "../../../../lib/api-helpers.js";
import { getDailyReportStats } from "../../../../lib/whatsapp-report-helper.js";

async function handler(req, res, user) {
  try {
    const db = await getDb();

    // 1. Get saved settings (or defaults)
    let settings = await db.collection("whatsapp_report_settings").findOne({ key: "daily_8pm_report" });

    if (!settings) {
      settings = {
        key: "daily_8pm_report",
        senderPhone: "8700994288",
        recipients: [
          { phone: "8700994288", label: "Admin Wasim", time: "20:00", active: true },
        ],
        autoSend: true,
        sendTime: "20:00", // 8:00 PM
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection("whatsapp_report_settings").insertOne(settings);
    }

    // Normalize recipients to array of structured objects (Max 4)
    let normalizedRecipients = [];
    if (Array.isArray(settings.recipients)) {
      normalizedRecipients = settings.recipients.slice(0, 4).map((item, idx) => {
        if (typeof item === "object" && item !== null) {
          return {
            phone: String(item.phone || "").replace(/[^0-9]/g, ""),
            label: item.label || `Recipient ${idx + 1}`,
            time: item.time || settings.sendTime || "20:00",
            active: item.active !== false,
          };
        }
        return {
          phone: String(item || "").replace(/[^0-9]/g, ""),
          label: `Recipient ${idx + 1}`,
          time: settings.sendTime || "20:00",
          active: true,
        };
      }).filter((r) => r.phone.length >= 10);
    }

    if (normalizedRecipients.length === 0) {
      normalizedRecipients = [{ phone: "8700994288", label: "Admin Wasim", time: "20:00", active: true }];
    }

    // 2. Fetch today's live preview data
    const { stats, formattedMessage } = await getDailyReportStats(db);

    // 3. Fetch recent dispatch logs
    const logs = await db
      .collection("whatsapp_report_logs")
      .find({})
      .sort({ createdAt: -1 })
      .limit(15)
      .toArray();

    return res.json({
      ok: true,
      success: true,
      settings: {
        senderPhone: settings.senderPhone || "8700994288",
        recipients: normalizedRecipients,
        autoSend: settings.autoSend !== false,
        sendTime: settings.sendTime || "20:00",
      },
      stats,
      formattedMessage,
      logs: logs.map((l) => ({
        _id: l._id.toString(),
        phone: l.phone,
        label: l.label || "",
        status: l.status,
        dateFormatted: l.dateFormatted,
        createdAt: l.createdAt,
        type: l.type || "automated",
        error: l.error || null,
      })),
    });
  } catch (err) {
    console.error("Get WhatsApp settings error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default requireRole("admin")(handler);
