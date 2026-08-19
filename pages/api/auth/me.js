// pages/api/auth/me.js
import { getUser, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import { getCache, setCache } from "../../../lib/redis.js";

export default async function handler(req, res) {
  try {
    const u = getUser(req);
    if (!u) return res.status(401).end();

    const cacheKey = `auth:user:${u.id || u.username}`;
    const cachedUser = await getCache(cacheKey);
    if (cachedUser) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cachedUser);
    }

    const db = await getDb();
    let freshUser = { ...u };

    if (u.role === "technician") {
      let tech = null;
      if (u.id && ObjectId.isValid(u.id)) {
        try {
          tech = await db.collection("technicians").findOne({ _id: new ObjectId(u.id) });
        } catch {}
      }
      if (!tech && u.username) {
        tech = await db.collection("technicians").findOne({ username: u.username });
      }

      if (tech) {
        freshUser = {
          ...freshUser,
          id: tech._id.toString(),
          username: tech.username,
          name: tech.name || tech.fullName || tech.techName || u.username,
          avatar: tech.avatar || tech.profilePic || tech.avatarUrl || tech.photo || tech.image || null,
          avatarPublicId: tech.avatarPublicId || null,
          phone: tech.phone || tech.mobile || null,
        };
      }
    } else if (u.role === "admin") {
      let adminUser = null;
      if (u.username) {
        adminUser = await db.collection("users").findOne({ username: u.username });
      }
      if (adminUser) {
        freshUser = {
          ...freshUser,
          id: adminUser._id.toString(),
          username: adminUser.username,
          name: adminUser.name || adminUser.fullName || u.username,
          avatar: adminUser.avatar || adminUser.profilePic || adminUser.avatarUrl || null,
        };
      }
    }

    await setCache(cacheKey, freshUser, 120);
    res.setHeader("X-Cache", "MISS");
    return res.json(freshUser);
  } catch (err) {
    console.error("Auth me error:", err);
    const u = getUser(req);
    if (!u) return res.status(401).end();
    return res.json(u);
  }
}
