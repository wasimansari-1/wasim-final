import { requireRole, getDb } from "../../../lib/api-helpers.js";
import bcrypt from "bcryptjs";
import { delPattern } from "../../../lib/redis.js";

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();
  const { username, password, phone = "", name = "" } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const cleanUsername = String(username).trim();
  const db = await getDb();

  const exists = await db.collection("technicians").findOne({ username: cleanUsername });
  if (exists) {
    return res.status(400).json({ error: "Technician username already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const insertDoc = {
    username: cleanUsername,
    name: String(name || cleanUsername).trim(),
    phone: String(phone || "").trim(),
    passwordHash,
    plainPassword: String(password).trim(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const r = await db.collection("technicians").insertOne(insertDoc);
  delPattern("admin:techs:*").catch(() => {});

  return res.json({
    ok: true,
    id: r.insertedId.toString(),
    message: "Technician created successfully",
    username: cleanUsername,
    plainPassword: String(password).trim(),
  });
}

export default requireRole("admin")(handler);
