import { ObjectId } from "mongodb";
import { getDb, requireRole } from "../../../lib/api-helpers.js";
import { sendNotification } from "../../../lib/firebaseAdmin.js";

function safeParseBody(body) {
  try { return typeof body === "string" ? JSON.parse(body) : body; } catch { return body; }
}

export default requireRole("admin")(async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = await getDb();
    const { callId, newTech } = safeParseBody(req.body) || {};

    if (!callId || !newTech)
      return res.status(400).json({ error: "Missing required fields" });

    const callObjId = new ObjectId(callId);

    // ⭐ Fetch existing call
    const call = await db.collection("forwarded_calls").findOne({ _id: callObjId });
    if (!call)
      return res.status(404).json({ error: "Call not found in forwarded_calls" });

    const oldTechId = call.techId || call.technicianId || null;

    // ⭐ Fetch new technician data
    const newTechData = await db
      .collection("technicians")
      .findOne({ _id: new ObjectId(newTech) });

    if (!newTechData)
      return res.status(404).json({ error: "Technician not found" });

    const newTechName =
      newTechData.username ||
      newTechData.name ||
      newTechData.fullName ||
      newTechData.techName ||
      "Technician";

    // ⭐ Update call with new technician + name
    await db.collection("forwarded_calls").updateOne(
      { _id: callObjId },
      {
        $set: {
          techId: new ObjectId(newTech),
          technicianId: new ObjectId(newTech),
          techName: newTechName,
          updatedAt: new Date(),
        }
      }
    );

    // ⭐ Remove from old technician
    if (oldTechId) {
      await db.collection("technicians").updateOne(
        { _id: new ObjectId(oldTechId) },
        { $pull: { assignedCalls: callId } }
      ).catch(() => {});
    }

    // ⭐ Add to new technician
    await db.collection("technicians").updateOne(
      { _id: new ObjectId(newTech) },
      { $addToSet: { assignedCalls: callId } }
    ).catch(() => {});

    // ⭐ Immediate response
    res.status(200).json({
      success: true,
      message: "Technician updated successfully",
      techName: newTechName
    });

    // ⭐ Background notification to new technician
    setImmediate(async () => {
      try {
        const tokenDocs = await db.collection("fcm_tokens").find({
          $or: [
            { userId: String(newTechData._id) },
            { userObjectId: newTechData._id },
            { username: newTechData.username },
          ],
        }).toArray();

        const tokens = tokenDocs.map(d => d.token).filter(Boolean);

        for (const token of tokens) {
          await sendNotification(
            token,
            "📞 Call Reassigned to You",
            `Client ${call.clientName || "Client"} (${call.phone || ""}) has been reassigned to you.`,
            {
              forwardedCallId: callId,
              clientName: call.clientName || "",
              phone: call.phone || "",
              url: "/tech/calls",
            },
            "/tech/calls"
          );
        }

        // Log notification in DB
        await db.collection("notifications").insertOne({
          to: newTechData.username || String(newTechData._id),
          techId: String(newTechData._id),
          title: "📞 Call Reassigned",
          message: `Client ${call.clientName || ""} assigned to you.`,
          data: { forwardedCallId: callId, url: "/tech/calls" },
          createdAt: new Date(),
          read: false,
        }).catch(() => {});

      } catch (fcmErr) {
        console.error("⚠ Reassign FCM Error:", fcmErr);
      }
    });

  } catch (err) {
    console.error("CHANGE TECH ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
