// pages/api/tech/profile.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { signToken } from "../../../lib/auth.js";
import { serialize } from "cookie";
import { ObjectId } from "mongodb";

async function handler(req, res, tokenUser) {
  const db = await getDb();
  const techCol = db.collection("technicians");

  // tokenUser is the token payload (from requireRole wrapper)
  const techId = tokenUser.id;

  if (!techId) return res.status(400).json({ error: "Invalid token: missing id" });

  // find technician by ObjectId (most reliable)
  let technician = null;
  try {
    technician = await techCol.findOne({ _id: new ObjectId(techId) });
  } catch (e) {
    // If ObjectId conversion fails, fall back to username
  }

  if (!technician && tokenUser.username) {
    technician = await techCol.findOne({ username: tokenUser.username });
  }

  if (!technician) {
    return res.status(404).json({ error: "Technician not found" });
  }

  if (req.method === "GET") {
    return res.json({
      _id: technician._id.toString(),
      username: technician.username,
      name: technician.name || technician.fullName || technician.username,
      avatar: technician.avatar || technician.profilePic || technician.avatarUrl || technician.photo || technician.image || null,
      avatarPublicId: technician.avatarPublicId || null,
      createdAt: technician.createdAt,
    });
  }

  if (req.method === "PATCH") {
    const { avatar, avatarPublicId, displayName } = req.body || {};

    const update = { updatedAt: new Date() };
    if (typeof avatar !== "undefined") update.avatar = avatar;
    if (typeof avatarPublicId !== "undefined") update.avatarPublicId = avatarPublicId;
    if (typeof displayName !== "undefined") update.displayName = displayName;

    await techCol.updateOne({ _id: technician._id }, { $set: update });

    // fetch fresh doc
    const fresh = await techCol.findOne({ _id: technician._id });

    // new token payload
    const newPayload = {
      id: fresh._id.toString(),
      username: fresh.username,
      role: fresh.role || "technician",
      avatar: fresh.avatar || null,
      avatarPublicId: fresh.avatarPublicId || null,
    };

    const token = signToken(newPayload);

    const isProd = process.env.NODE_ENV === "production";
    const cookie = serialize("token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 60 * 60 * 24 * 30,
    });
    res.setHeader("Set-Cookie", cookie);

    return res.status(200).json({ success: true, user: newPayload });
  }

  res.status(405).end();
}

export default requireRole("technician")(handler);
