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

    // Clean and validate recipients (MAXIMUM 4 NUMBERS STRICTLY ENFORCED)
    const cleanedRecipients = [];
    const seenPhones = new Set();

    for (const item of recipients) {
      const rawPhone = typeof item === "object" ? item.phone : item;
      const cleanPhone = String(rawPhone || "").trim().replace(/[^0-9]/g, "");

      if (cleanPhone.length >= 10 && !seenPhones.has(cleanPhone)) {
        seenPhones.add(cleanPhone);
        const label = typeof item === "object" && item.label ? String(item.label).trim() : `Recipient ${cleanedRecipients.length + 1}`;
        const time = typeof item === "object" && item.time ? String(item.time).trim() : (sendTime || "20:00");
        const active = typeof item === "object" && typeof item.active !== "undefined" ? Boolean(item.active) : true;

        cleanedRecipients.push({
          phone: cleanPhone,
          label: label.slice(0, 30),
          time: time || "20:00",
          active,
        });
      }
    }

    if (cleanedRecipients.length === 0) {
      return res.status(400).json({ ok: false, message: "At least 1 recipient phone number is required." });
    }

    if (cleanedRecipients.length > 4) {
      return res.status(400).json({
        ok: false,
        message: "Maximum 4 recipient phone numbers allowed. Ek sath maximum 4 number ko hi report bheja ja sakta hai.",
      });
    }

    const simplePhoneList = cleanedRecipients.map((r) => r.phone);

    const updateDoc = {
      senderPhone: "8700994288",
      recipients: cleanedRecipients, // Full rich objects
      recipientPhones: simplePhoneList, // Simple array for quick compatibility
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
      message: `WhatsApp Report settings saved! ${cleanedRecipients.length} of 4 recipient slots configured.`,
      settings: updateDoc,
    });
  } catch (err) {
    console.error("Save WhatsApp settings error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default requireRole("admin")(handler);
