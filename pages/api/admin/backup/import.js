// pages/api/admin/backup/import.js
import { requireRole, getDb } from "../../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

// Helper to convert valid 24-hex string to ObjectId
function sanitizeDoc(doc) {
  const clean = { ...doc };
  if (clean._id) {
    if (typeof clean._id === "string" && ObjectId.isValid(clean._id) && clean._id.length === 24) {
      try {
        clean._id = new ObjectId(clean._id);
      } catch {}
    }
  }

  // Convert date fields if string
  const dateFields = ["createdAt", "updatedAt", "closedAt", "date", "assignedAt"];
  for (const field of dateFields) {
    if (clean[field] && typeof clean[field] === "string") {
      const parsed = new Date(clean[field]);
      if (!isNaN(parsed.getTime())) {
        clean[field] = parsed;
      }
    }
  }

  return clean;
}

async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const db = await getDb();
    const { backupPayload, mode = "upsert" } = req.body || {};

    if (!backupPayload || !backupPayload.data || typeof backupPayload.data !== "object") {
      return res.status(400).json({
        ok: false,
        message: "Invalid backup file format. Must contain valid backup 'data' object.",
      });
    }

    const dataObj = backupPayload.data;
    const restoredSummary = {};
    let totalRestored = 0;

    const allowedCollections = [
      "forwarded_calls",
      "payments",
      "service_forms",
      "technicians",
      "users",
      "whatsapp_report_settings",
      "whatsapp_report_logs",
    ];

    for (const [collName, docs] of Object.entries(dataObj)) {
      if (!allowedCollections.includes(collName) || !Array.isArray(docs) || docs.length === 0) {
        restoredSummary[collName] = 0;
        continue;
      }

      const coll = db.collection(collName);

      // In overwrite mode, clean collection (except admin user to prevent lockout)
      if (mode === "overwrite") {
        if (collName === "users") {
          await coll.deleteMany({ role: { $ne: "admin" } });
        } else {
          await coll.deleteMany({});
        }
      }

      const operations = [];

      for (const rawDoc of docs) {
        const doc = sanitizeDoc(rawDoc);
        if (doc._id) {
          operations.push({
            replaceOne: {
              filter: { _id: doc._id },
              replacement: doc,
              upsert: true,
            },
          });
        } else {
          operations.push({
            insertOne: {
              document: doc,
            },
          });
        }
      }

      if (operations.length > 0) {
        // Chunk operations into batches of 500 for MongoDB safety
        const chunkSize = 500;
        let collCount = 0;

        for (let i = 0; i < operations.length; i += chunkSize) {
          const chunk = operations.slice(i, i + chunkSize);
          const result = await coll.bulkWrite(chunk, { ordered: false });
          collCount += (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.insertedCount || 0);
        }

        restoredSummary[collName] = collCount || docs.length;
        totalRestored += docs.length;
      }
    }

    // Record restore log
    await db.collection("system_logs").insertOne({
      action: "database_restore",
      mode,
      restoredSummary,
      totalRestored,
      restoredBy: user?.username || "admin",
      backupGeneratedAt: backupPayload.generatedAt || null,
      createdAt: new Date(),
    });

    return res.json({
      ok: true,
      success: true,
      message: `Database Restore Complete: ${totalRestored} records restored across ${Object.keys(restoredSummary).length} collections.`,
      restoredSummary,
      totalRestored,
      mode,
    });
  } catch (err) {
    console.error("Import backup error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default requireRole("admin")(handler);
