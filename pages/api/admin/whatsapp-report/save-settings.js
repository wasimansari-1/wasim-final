// pages/api/admin/whatsapp-report/save-settings.js
import { requireRole, getDb } from "../../../../lib/api-helpers.js";

async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const db = await getDb();
    const { recipients, autoSend, sendTime } = req.body || {};

    if (!Array.isArray(recipients)) {
      return res.status(400).json({ ok: false, message: "Recipients must be an array" });
    }

    // Clean and validate recipients (MAX 3 NUMBERS)
    const cleanedRecipients = recipients
      .map((num) => String(num || "").trim().replace(/[^0-9]/g, ""))
      .filter((num) => num.length >= 10);

    // Remove duplicates
    const uniqueRecipients = Array.from(new Set(cleanedRecipients));

    if (uniqueRecipients.length === 0) {
      return res.status(400).json({ ok: false, message: "At least 1 recipient phone number is required" });
    }

    if (uniqueRecipients.length > 3) {
      return res.status(400).json({
        ok: false,
        message: "Maximum 3 recipient phone numbers allowed. Please remove extra numbers.",
      });
    }

    const updateDoc = {
      senderPhone: "8700994288",
      recipients: uniqueRecipients,
      autoSend: Boolean(autoSend),
      sendTime: sendTime || "20:00",
      updatedAt: new Date(),
      updatedBy: user?.username || "admin",
    };

    await db.collection("whatsapp_report_settings").updateOne(
      { key: "daily_8pm_report" },
      { $set: updateDoc },
      { upsert: true }
    );

    return res.json({
      ok: true,
      success: true,
      message: "WhatsApp Report Settings Saved Successfully",
      settings: updateDoc,
    });
  } catch (err) {
    console.error("Save WhatsApp settings error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default requireRole("admin")(handler);
