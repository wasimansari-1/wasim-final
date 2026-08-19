import { ObjectId } from "mongodb";
import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { sendNotification, syncFirestoreCall } from "../../../lib/firebaseAdmin.js";
import { delPattern } from "../../../lib/redis.js";

function safeParseBody(body) {
  try { return typeof body === "string" ? JSON.parse(body) : body; } catch { return body; }
}

export default requireRole("admin")(async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = await getDb();
    const body = safeParseBody(req.body) || {};
    const callId = body.callId || body._id || body.id;
    const newTech = body.newTech || body.techId || body.newTechId;

    if (!callId || !newTech)
      return res.status(400).json({ error: "Missing required fields (callId and newTech)" });

    let callObjId = null;
    if (ObjectId.isValid(callId)) {
      callObjId = new ObjectId(callId);
    }

    // ⭐ Fetch existing call
    const call = await db.collection("forwarded_calls").findOne({
      $or: [{ _id: callObjId }, { _id: String(callId) }].filter(Boolean),
    });

    if (!call)
      return res.status(404).json({ error: "Call not found in forwarded_calls" });

    const oldTechId = call.techId || call.technicianId || null;

    // ⭐ Fetch new technician data
    let newTechObjId = null;
    if (ObjectId.isValid(newTech)) {
      newTechObjId = new ObjectId(newTech);
    }

    const newTechData = await db.collection("technicians").findOne({
      $or: [{ _id: newTechObjId }, { _id: String(newTech) }, { username: String(newTech) }].filter(Boolean),
    });

    if (!newTechData)
      return res.status(404).json({ error: "Technician not found" });

    const newTechName =
      (newTechData.name && newTechData.name.trim()) ||
      (newTechData.fullName && newTechData.fullName.trim()) ||
      (newTechData.techName && newTechData.techName.trim()) ||
      (newTechData.username && newTechData.username.trim()) ||
      "Technician";

    // ⭐ Update call with new technician + name
    await db.collection("forwarded_calls").updateOne(
      { _id: call._id },
      {
        $set: {
          techId: newTechData._id,
          technicianId: newTechData._id,
          techName: newTechName,
          updatedAt: new Date(),
        }
      }
    );

    // ⭐ Remove from old technician's list
    if (oldTechId) {
      const oldTechObjId = ObjectId.isValid(oldTechId) ? new ObjectId(oldTechId) : oldTechId;
      await db.collection("technicians").updateOne(
        { $or: [{ _id: oldTechObjId }, { _id: String(oldTechId) }] },
        { $pull: { assignedCalls: { $in: [String(callId), callObjId, call._id, String(call._id)].filter(Boolean) } } }
      ).catch(() => {});
    }

    // ⭐ Add to new technician's list
    await db.collection("technicians").updateOne(
      { _id: newTechData._id },
      { $addToSet: { assignedCalls: String(call._id) } }
    ).catch(() => {});

    // ⭐ Invalidate ALL Redis caches
    await Promise.all([
      delPattern("admin:calls:*").catch(() => {}),
      delPattern("tech:calls:*").catch(() => {}),
      delPattern("admin:summary:*").catch(() => {}),
      delPattern("admin:technician-calls:*").catch(() => {}),
      delPattern("admin:customer-payments:*").catch(() => {}),
      delPattern("admin:payments:*").catch(() => {}),
    ]);

    // ⭐ Immediate response
    res.status(200).json({
      success: true,
      message: "Technician updated successfully",
      techName: newTechName,
      techId: String(newTechData._id),
    });

    // ⭐ Background notification to new technician + live socket broadcast
    setImmediate(async () => {
      try {
        // 0. Live Firestore socket broadcast
        syncFirestoreCall(call._id, {
          techId: String(newTechData._id),
          techName: newTechName,
        }).catch(() => {});

        const tokenDocs = await db.collection("fcm_tokens").find({
          $or: [
            { userId: String(newTechData._id) },
            { userObjectId: newTechData._id },
            { username: { $regex: new RegExp("^" + (newTechData.username || "") + "$", "i") } },
            ...(newTechData.name ? [{ username: { $regex: new RegExp("^" + newTechData.name + "$", "i") } }] : []),
          ],
        }).toArray();

        const dbTokens = tokenDocs.map((d) => d.token).filter(Boolean);
        const directTokens = Array.isArray(newTechData.fcmTokens)
          ? newTechData.fcmTokens
          : newTechData.fcmToken
          ? [newTechData.fcmToken]
          : [];

        const tokens = Array.from(new Set([...dbTokens, ...directTokens])).filter(
          (t) => typeof t === "string" && t.trim().length > 20
        );

        for (const token of tokens) {
          await sendNotification(
            token,
            `📞 ${newTechName} - Call Reassigned`,
            `Assigned to: ${newTechName} | Client: ${call.clientName || "Client"} (${call.phone || ""})`,
            {
              forwardedCallId: String(call._id),
              clientName: call.clientName || "",
              phone: call.phone || "",
              techName: newTechName,
              url: "/tech/calls",
            },
            "/tech/calls"
          );
        }

        // Log notification in DB
        await db.collection("notifications").insertOne({
          to: newTechData.username || String(newTechData._id),
          techId: String(newTechData._id),
          title: `📞 ${newTechName} - Call Reassigned`,
          message: `Assigned to ${newTechName}: Client ${call.clientName || ""} (${call.phone || ""})`,
          data: { forwardedCallId: String(call._id), url: "/tech/calls" },
          createdAt: new Date(),
          read: false,
        }).catch(() => {});

      } catch (fcmErr) {
        console.error("⚠ Reassign FCM Error:", fcmErr);
      }
    });

  } catch (err) {
    console.error("❌ REASSIGN ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
