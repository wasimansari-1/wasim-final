// pages/api/admin/backup/export.js
import { requireRole, getDb } from "../../../../lib/api-helpers.js";

async function handler(req, res, user) {
  try {
    const db = await getDb();
    const {
      range = "all", // "all" or "custom"
      startDate,
      endDate,
      collections = "all",
      download = "1",
    } = req.query;

    const dateFilter = {};
    if (range === "custom" && (startDate || endDate)) {
      dateFilter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const selectedCollections =
      collections === "all"
        ? [
            "forwarded_calls",
            "payments",
            "service_forms",
            "technicians",
            "users",
            "whatsapp_report_settings",
            "whatsapp_report_logs",
          ]
        : collections.split(",").map((c) => c.trim());

    const backupData = {};
    const recordCounts = {};

    for (const collName of selectedCollections) {
      try {
        const coll = db.collection(collName);
        let query = {};

        // Apply date filter if collection supports createdAt and custom range selected
        if (hasDateFilter && ["forwarded_calls", "payments", "service_forms", "whatsapp_report_logs"].includes(collName)) {
          query = dateFilter;
        }

        const docs = await coll.find(query).toArray();
        backupData[collName] = docs.map((d) => ({
          ...d,
          _id: d._id.toString(),
        }));
        recordCounts[collName] = docs.length;
      } catch (err) {
        console.warn(`Error exporting collection ${collName}:`, err);
        backupData[collName] = [];
        recordCounts[collName] = 0;
      }
    }

    const payload = {
      app: "Chimney Solutions CRM",
      backupVersion: "1.0",
      generatedAt: new Date().toISOString(),
      generatedBy: user?.username || "admin",
      range: range === "custom" ? { type: "custom", startDate, endDate } : { type: "all_time" },
      recordCounts,
      totalRecords: Object.values(recordCounts).reduce((a, b) => a + b, 0),
      data: backupData,
    };

    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `chimney_solutions_backup_${range === "custom" ? "custom_" : "all_"}${dateSlug}.json`;

    if (download === "1") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.status(200).send(JSON.stringify(payload, null, 2));
    }

    return res.json({
      ok: true,
      success: true,
      filename,
      payload,
    });
  } catch (err) {
    console.error("Export backup error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default requireRole("admin")(handler);
