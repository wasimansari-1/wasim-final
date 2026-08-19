import { ObjectId } from "mongodb";
import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { sendNotification } from "../../../lib/firebaseAdmin.js";

function safeParseBody(body) {
  try { return typeof body === "string" ? JSON.parse(body) : body; } catch { return body; }
}

export default requireRole("admin")(async (req, res, adminUser) => {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      target = "all", // "all" or "specific"
      techId = "",
      title = "",
      body = "",
      url = "/tech/calls",
    } = safeParseBody(req.body) || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: "Notification title is required." });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, error: "Notification message body is required." });
    }

    const db = await getDb();
    const fcmColl = db.collection("fcm_tokens");
    const notifColl = db.collection("notifications");

    let query = {};
    let targetDescription = "all technicians";

    if (target === "specific" && techId) {
      const candidates = [String(techId)];
      if (ObjectId.isValid(techId)) {
        candidates.push(new ObjectId(techId));
      }

      // Also get technician username
      const techDoc = await db.collection("technicians").findOne({
        $or: [{ _id: ObjectId.isValid(techId) ? new ObjectId(techId) : null }, { username: String(techId) }].filter(Boolean),
      });

      if (techDoc) {
        candidates.push(techDoc.username);
        targetDescription = techDoc.username || "technician";
      }

      query = {
        $or: [
          { userId: { $in: candidates.map(String) } },
          { userObjectId: { $in: candidates.filter(c => typeof c !== "string") } },
          { username: techDoc?.username || String(techId) },
        ],
      };
    } else {
      // All technicians
      query = {
        $or: [
          { role: "technician" },
          { role: { $exists: false } },
        ],
      };
    }

    const tokenDocs = await fcmColl.find(query).toArray();
    const tokens = Array.from(new Set(tokenDocs.map((d) => d.token).filter(Boolean)));

    if (tokens.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        message: `No active device tokens found for ${targetDescription}. Note: Tokens register when technicians open the app.`,
      });
    }

    let successCount = 0;
    let failureCount = 0;

    const finalTitle =
      target === "specific" && targetDescription && !title.toLowerCase().includes(targetDescription.toLowerCase())
        ? `🔔 ${targetDescription} - ${title.trim()}`
        : title.trim();

    // Send push notifications in parallel with limit
    await Promise.all(
      tokens.map(async (token) => {
        try {
          const sent = await sendNotification(
            token,
            finalTitle,
            body.trim(),
            {
              type: "custom_admin_broadcast",
              sender: "Admin",
              techName: targetDescription,
              url: url || "/tech/calls",
              sentAt: new Date().toISOString(),
            },
            url || "/tech/calls"
          );
          if (sent) successCount++;
          else failureCount++;
        } catch (e) {
          failureCount++;
        }
      })
    );

    // Save notification in database
    await notifColl.insertOne({
      to: target === "specific" ? targetDescription : "all_technicians",
      target,
      techId: techId || null,
      title: title.trim(),
      message: body.trim(),
      url: url || "/tech/calls",
      sentBy: adminUser.username || "admin",
      successCount,
      failureCount,
      createdAt: new Date(),
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      count: successCount,
      failed: failureCount,
      message: `Custom push notification delivered to ${successCount} device(s).`,
    });
  } catch (err) {
    console.error("❌ Send custom notification error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
});
