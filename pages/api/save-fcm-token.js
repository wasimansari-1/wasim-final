// pages/api/save-fcm-token.js
import { ObjectId } from "mongodb";
import clientPromise from "../../lib/mongodb.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const { token, userId, username, role = "technician" } = req.body || {};

    if (!token) {
      return res.status(400).json({ ok: false, message: "Missing token" });
    }

    const cleanToken = String(token).trim();
    const client = await clientPromise;
    const db = client.db("mydatabase");
    const collection = db.collection("fcm_tokens");

    // 1. Upsert token record per device token (supports multiple phones per technician)
    const updateDoc = {
      token: cleanToken,
      role: String(role || "technician"),
      updatedAt: new Date(),
    };

    if (userId) {
      updateDoc.userId = String(userId);
      if (ObjectId.isValid(userId)) {
        updateDoc.userObjectId = new ObjectId(userId);
      }
    }

    if (username) {
      updateDoc.username = String(username).trim();
    }

    await collection.updateOne(
      { token: cleanToken },
      {
        $set: updateDoc,
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    // 2. Also attach token directly to technician document for instant lookup
    if (userId || username) {
      const techFilter = {};
      if (userId && ObjectId.isValid(userId)) {
        techFilter._id = new ObjectId(userId);
      } else if (username) {
        techFilter.username = String(username).trim();
      }

      await db.collection("technicians").updateOne(
        techFilter,
        {
          $addToSet: { fcmTokens: cleanToken },
          $set: { fcmToken: cleanToken, lastActiveAt: new Date() },
        }
      ).catch(() => {});
    }

    console.log("✅ Device Push Token saved for technician:", { userId, username, role });
    return res.status(200).json({ ok: true, message: "Device push token registered successfully" });
  } catch (error) {
    console.error("❌ Error saving FCM token:", error);
    return res.status(500).json({ ok: false, message: error.message || "Error saving token" });
  }
}
