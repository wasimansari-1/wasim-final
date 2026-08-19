export const runtime = "nodejs";

import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: true,
  },
};

import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { sendNotification } from "../../../lib/firebaseAdmin.js";

// ------------ WhatsApp Sender (NON-BLOCKING) ------------
async function sendWhatsAppMessage(phone, clientName, serviceType) {
  try {
    phone = phone.startsWith("+91") ? phone : "+91" + phone;

    const apiKey =
      process.env.WAPPBIZ_KEY ||
      "28b55ddd7e798fc7b49725ecec55bfd25bcc605d2a2267536a2d39598b4f54b2";

    const formattedDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const payload = {
      template_name: "service_registered",
      phone: phone,
      name: clientName,
      parameters: `${clientName}, ${serviceType}, ${formattedDate}`,
    };

    const url = `https://api.wapp.biz/api/external/sendTemplate?apikey=${apiKey}`;

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((d) => console.log("📨 WA SENT BG:", d))
      .catch((e) => console.error("❌ WA BG ERROR:", e));
  } catch (err) {
    console.error("❌ WhatsApp Catch Error:", err);
  }
}

// ------------ Core Forward Logic (Ultra Fast) ------------
async function forwardCore(req, res, user) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const {
      clientName,
      phone,
      address,
      techId,
      price,
      type,
      serviceType,
      service,
      category,
      jobType,
      timeZone,
      notes,
      chooseCall,
    } = req.body || {};

    const finalType =
      type || serviceType || service || category || jobType || "Service";

    if (!clientName || !phone || !address || !techId || !chooseCall) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!ObjectId.isValid(techId)) {
      return res.status(400).json({ error: "Invalid technician ID" });
    }

    const techObjectId = new ObjectId(techId);
    const db = await getDb();

    const tech = await db.collection("technicians").findOne({ _id: techObjectId });
    if (!tech) return res.status(404).json({ error: "Technician not found" });

    const normalizedPhone = phone.startsWith("+91") ? phone : "+91" + phone;

    const insertDoc = {
      clientName: clientName.trim(),
      phone: normalizedPhone,
      address: address.trim(),
      price: Number(price) || 0,
      type: finalType,
      timeZone: timeZone || "",
      notes: notes || "",
      techId: tech._id,
      techName: tech.username || tech.name || "Technician",
      status: "Pending",
      chooseCall,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("forwarded_calls").insertOne(insertDoc);
    const insertedId = result.insertedId.toString();

    // Also link call to technician document
    db.collection("technicians").updateOne(
      { _id: tech._id },
      { $addToSet: { assignedCalls: insertedId } }
    ).catch(() => {});

    // ⭐ ULTRA FAST RESPONSE — return immediately
    res.status(200).json({ ok: true, id: insertedId });

    // ⭐ Background Tasks (NON-BLOCKING)
    setImmediate(async () => {
      try {
        // 1. WhatsApp Notification (if CHIMNEY_SOLUTIONS chosen)
        if (chooseCall === "CHIMNEY_SOLUTIONS") {
          try {
            sendWhatsAppMessage(insertDoc.phone, clientName, finalType);
            console.log("ℹ️ WhatsApp template queued (CHIMNEY_SOLUTIONS).");
          } catch (waErr) {
            console.error("⚠ WA send error:", waErr);
          }
        }

        // 2. FCM Push Notification to Assigned Technician
        try {
          const techTokenDocs = await db.collection("fcm_tokens").find({
            $or: [
              { userId: String(tech._id) },
              { userObjectId: tech._id },
              { username: tech.username },
            ],
          }).toArray();

          const tokens = techTokenDocs.map(d => d.token).filter(Boolean);

          if (tokens.length > 0) {
            for (const token of tokens) {
              await sendNotification(
                token,
                "📞 New Call Assigned",
                `Client ${clientName} (${insertDoc.phone}) assigned to you. Price: ₹${insertDoc.price}`,
                {
                  forwardedCallId: insertedId,
                  clientName: insertDoc.clientName,
                  phone: insertDoc.phone,
                  url: "/tech/calls",
                },
                "/tech/calls"
              );
            }
          } else {
            console.warn("⚠️ No FCM token found for technician:", tech.username);
          }

          // 3. Log notification in DB for technician history
          await db.collection("notifications").insertOne({
            to: tech.username || String(tech._id),
            techId: String(tech._id),
            title: "📞 New Call Assigned",
            message: `New call: ${clientName} (${insertDoc.phone})`,
            data: { forwardedCallId: insertedId, url: "/tech/calls" },
            createdAt: new Date(),
            read: false,
          }).catch(() => {});

        } catch (err) {
          console.error("⚠ FCM BG Error in forward:", err);
        }
      } catch (bgErr) {
        console.error("⚠ Background task error:", bgErr);
      }
    });

  } catch (err) {
    console.error("❌ Forward Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// ------------ Export Handler ------------
export default async function handler(req, res) {
  const guarded = requireRole("admin")(forwardCore);
  return guarded(req, res);
}
