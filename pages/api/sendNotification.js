import { sendNotification } from "../../lib/firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { token, title, body, url = "/tech/calls", data = {} } = req.body || {};

    if (!token) {
      return res.status(200).json({ success: false, message: "No token provided" });
    }

    const sent = await sendNotification(token, title, body, data, url);

    return res.status(200).json({
      success: true,
      delivered: Boolean(sent),
      message: sent ? "Notification sent successfully" : "Device unreachable or token refreshed",
    });
  } catch (err) {
    console.warn("⚠️ Notification warning:", err?.message || err);
    return res.status(200).json({ success: false, error: err.message || "Push service notice" });
  }
}
