// pages/api/tech/profile.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { signToken } from "../../../lib/auth.js";
import { serialize } from "cookie";
import { ObjectId } from "mongodb";
import { getCache, setCache, delCache } from "../../../lib/redis.js";

async function handler(req, res, tokenUser) {
  const techId = tokenUser.id;
  if (!techId) return res.status(400).json({ error: "Invalid token: missing id" });

  const cacheKey = `tech:profile:${techId}`;

  if (req.method === "GET") {
    const cachedProfile = await getCache(cacheKey);
    if (cachedProfile) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cachedProfile);
    }
  }

  const db = await getDb();
  const techCol = db.collection("technicians");

  let technician = null;
  try {
    technician = await techCol.findOne({ _id: new ObjectId(techId) });
  } catch (e) {}

  if (!technician && tokenUser.username) {
    technician = await techCol.findOne({ username: tokenUser.username });
  }

  if (!technician) {
    return res.status(404).json({ error: "Technician not found" });
  }

  if (req.method === "GET") {
    const profileData = {
      _id: technician._id.toString(),
      username: technician.username,
      name: technician.name || technician.fullName || technician.username,
      avatar: technician.avatar || technician.profilePic || technician.avatarUrl || technician.photo || technician.image || null,
      avatarPublicId: technician.avatarPublicId || null,
      createdAt: technician.createdAt,
    };

    await setCache(cacheKey, profileData, 120);
    res.setHeader("X-Cache", "MISS");
    return res.json(profileData);
  }

  if (req.method === "PATCH") {
    const { avatar, avatarPublicId, displayName } = req.body || {};

    const update = { updatedAt: new Date() };
    if (typeof avatar !== "undefined") update.avatar = avatar;
    if (typeof avatarPublicId !== "undefined") update.avatarPublicId = avatarPublicId;
    if (typeof displayName !== "undefined") update.displayName = displayName;

    await techCol.updateOne({ _id: technician._id }, { $set: update });

    // Invalidate Redis caches
    await Promise.all([
      delCache(cacheKey),
      delCache(`auth:user:${technician._id}`),
      delCache(`auth:user:${technician.username}`),
    ]).catch(() => {});

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
