// pages/api/tech/update-call.js
import fetch from "node-fetch";
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { delPattern } from "../../../lib/redis.js";

export const config = {
  api: {
    bodyParser: true,
  },
};

// Allowed status values
const ALLOWED = new Set(["Pending", "Completed", "Closed", "Canceled"]);

// -------- WhatsApp Completion Message --------
async function sendCompletionMessage(phone, clientName, serviceType, techName) {
  try {
    phone = String(phone || "");
    phone = phone.startsWith("+91") ? phone : "+91" + phone.replace(/^0+/, "");

    const apiKey =
      process.env.WAPPBIZ_KEY ||
      "28b55ddd7e798fc7b49725ecec55bfd25bcc605d2a2267536a2d39598b4f54b2";

    const payload = {
      template_name: "service_completed",
      phone: phone,
      name: clientName,
      parameters: `${clientName}, ${serviceType}, ${techName}`,
    };

    const url = `https://api.wapp.biz/api/external/sendTemplate?apikey=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({ ok: false }));
    console.log("📨 WhatsApp Completion Result:", result);
    return result;
  } catch (err) {
    console.error("❌ WhatsApp Send Error:", err);
  }
}

// -------- Main Handler --------
async function handler(req, res, user) {
  if (req.method !== "POST" && req.method !== "PUT") {
    res.setHeader("Allow", ["POST", "PUT"]);
    return res.status(405).json({ ok: false, success: false, message: "Method Not Allowed" });
  }

  try {
    const rawId = req.body?.id || req.body?.callId;
    const { status, notes = "" } = req.body || {};

    if (!rawId || !status) {
      return res.status(400).json({ ok: false, success: false, message: "id/callId and status are required." });
    }
    if (!ObjectId.isValid(rawId)) {
      return res.status(400).json({ ok: false, success: false, message: "Invalid call id." });
    }
    if (!ALLOWED.has(String(status))) {
      return res.status(400).json({ ok: false, success: false, message: "Invalid status value." });
    }

    const _id = new ObjectId(rawId);

    // techIdCandidates ensures technicians can update their own calls
    const techIdCandidates = [user.id];
    if (ObjectId.isValid(user.id)) techIdCandidates.push(new ObjectId(user.id));

    const db = await getDb();

    // Find call before update
    const callData = await db.collection("forwarded_calls").findOne({
      _id,
      techId: { $in: techIdCandidates },
    });

    if (!callData) {
      return res.status(404).json({ ok: false, message: "Call not found for this technician." });
    }

    const now = new Date();
    const updateDoc = {
      $set: {
        status: String(status),
        updatedAt: now,
      }
    };

    if (notes && String(notes).trim()) {
      updateDoc.$set.notes = String(notes).trim();
    }

    if (String(status) === "Closed" || String(status) === "Completed") {
      updateDoc.$set.closedAt = now;
      updateDoc.$set.closedBy = user.id;
      updateDoc.$set.closedByName = user.username || callData.techName || "Technician";
    } else if (String(status) === "Canceled") {
      updateDoc.$set.canceledAt = now;
      updateDoc.$set.canceledBy = user.id;
      updateDoc.$set.canceledByName = user.username || callData.techName || "Technician";
    } else if (String(status) === "Pending") {
      updateDoc.$unset = { closedAt: "", closedBy: "", closedByName: "", canceledAt: "", canceledBy: "" };
    }

    // Update call in DB
    const result = await db.collection("forwarded_calls").updateOne(
      { _id, techId: { $in: techIdCandidates } },
      updateDoc
    );

    res.setHeader("Cache-Control", "private, no-store");

    if (result.matchedCount === 0) {
      return res.status(404).json({ ok: false, message: "Call not found." });
    }

    // Invalidate Redis cache for technician calls & admin dashboards
    delPattern(`tech:calls:${user.id}:*`).catch(() => {});
    delPattern("tech:calls:*").catch(() => {});
    delPattern("admin:summary:*").catch(() => {});

    // Respond immediately for ultra snappy UI
    res.status(200).json({
      ok: true,
      success: true,
      modified: result.modifiedCount === 1,
      closedAt: (String(status) === "Closed" || String(status) === "Completed") ? now : null,
      closedByName: user.username || callData.techName,
    });

    // ---------- Background tasks (non-blocking) ----------
    setImmediate(async () => {
      try {
        // 1. WhatsApp Notification on Close
        if (String(status) === "Closed" || String(status) === "Completed") {
          const chosen = String(callData.chooseCall || "").toUpperCase();
          if (chosen === "CHIMNEY_SOLUTIONS" || chosen === "CHIMNEY SOLUTIONS") {
            try {
              await sendCompletionMessage(
                callData.phone,
                callData.clientName,
                callData.type || "Service",
                user.username || callData.techName || "Technician"
              );
            } catch (waErr) {
              console.error("⚠ WA completion error:", waErr);
            }
          }

          // 2. Log Admin Notification
          await db.collection("notifications").insertOne({
            to: "admin",
            type: "call_closed",
            title: "✅ Call Closed",
            message: `Technician ${user.username || callData.techName} closed call for ${callData.clientName} (₹${callData.price || 0})`,
            callId: String(_id),
            clientName: callData.clientName,
            techName: user.username || callData.techName,
            closedAt: now,
            createdAt: now,
            read: false,
          }).catch(() => {});
        }
      } catch (bgErr) {
        console.error("⚠ Background task error in update-call:", bgErr);
      }
    });

  } catch (e) {
    console.error("update-status error:", e);
    return res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
}

export default requireRole("technician")(handler);
