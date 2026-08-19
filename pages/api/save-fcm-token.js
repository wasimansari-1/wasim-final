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

    const client = await clientPromise;
    const db = client.db("mydatabase");
    const collection = db.collection("fcm_tokens");

    // Build flexible query matching token or userId
    const filter = {};
    if (userId) {
      filter.userId = String(userId);
    } else {
      filter.token = token;
    }

    const updateDoc = {
      token: String(token).trim(),
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

    const result = await collection.updateOne(
      filter,
      { $set: updateDoc },
      { upsert: true }
    );

    console.log("✅ FCM Token saved successfully for user:", { userId, username, role });
    return res.status(200).json({ ok: true, message: "Token saved", result });
  } catch (error) {
    console.error("❌ Error saving FCM token:", error);
    return res.status(500).json({ ok: false, message: error.message || "Error saving token" });
  }
}
