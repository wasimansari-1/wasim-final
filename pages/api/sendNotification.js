import { sendNotification } from "../../lib/firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { token, title, body, url = "/tech/calls", data = {} } = req.body || {};

    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    const sent = await sendNotification(token, title, body, data, url);

    if (sent) {
      return res.status(200).json({ success: true, message: "Notification sent successfully" });
    } else {
      return res.status(500).json({ success: false, error: "Failed to deliver push notification" });
    }
  } catch (err) {
    console.error("❌ Notification error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
