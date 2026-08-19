// pages/api/update-location.js
import { getDb } from "../../lib/api-helpers.js";
import { setCache } from "../../lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  try {
    const { technicianId, lat, lng } = req.body || {};
    if (!technicianId || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, error: "technicianId, lat, and lng are required." });
    }

    const locationData = {
      technicianId: String(technicianId),
      lat: Number(lat),
      lng: Number(lng),
      updatedAt: new Date(),
    };

    // Cache location in Redis for real-time sub-millisecond retrieval (TTL: 1 hour)
    await setCache(`tech:location:${technicianId}`, locationData, 3600);

    const db = await getDb();
    await db.collection("technician_locations").updateOne(
      { technicianId: String(technicianId) },
      { $set: locationData },
      { upsert: true }
    );

    return res.status(200).json({ success: true, message: "Location updated" });
  } catch (err) {
    console.error("update-location error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}
