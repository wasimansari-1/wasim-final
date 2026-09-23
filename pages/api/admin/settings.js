// pages/api/admin/settings.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { delPattern } from "../../../lib/redis.js";

async function handler(req, res, user) {
  try {
    const db = await getDb();
    const settingsColl = db.collection("system_settings");

    if (req.method === "GET") {
      let doc = await settingsColl.findOne({ key: "general_settings" });
      if (!doc) {
        doc = {
          key: "general_settings",
          allowDirectMarkPaid: false,
          updatedAt: new Date(),
        };
        await settingsColl.insertOne(doc);
      }
      return res.status(200).json({
        success: true,
        settings: {
          allowDirectMarkPaid: Boolean(doc.allowDirectMarkPaid),
        },
      });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = req.body || {};
      const allowDirectMarkPaid = Boolean(body.allowDirectMarkPaid);

      await settingsColl.updateOne(
        { key: "general_settings" },
        {
          $set: {
            allowDirectMarkPaid,
            updatedAt: new Date(),
            updatedBy: user.username || user.name || user.id,
          },
        },
        { upsert: true }
      );

      try {
        await delPattern("settings:*");
      } catch {}

      return res.status(200).json({
        success: true,
        message: "Settings updated successfully",
        settings: {
          allowDirectMarkPaid,
        },
      });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (err) {
    console.error("Admin settings error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

export default requireRole("admin")(handler);
