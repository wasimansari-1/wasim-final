import { requireRole, getDb } from "../../../lib/api-helpers.js";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { delPattern } from "../../../lib/redis.js";

async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).end();

  const { id, techId, password } = req.body || {};
  const targetId = techId || id;

  if (!targetId || !password) {
    return res.status(400).json({ error: "Technician ID and new password are required" });
  }

  const cleanPassword = String(password).trim();
  if (cleanPassword.length < 3) {
    return res.status(400).json({ error: "Password must be at least 3 characters" });
  }

  try {
    const db = await getDb();
    const query = ObjectId.isValid(targetId) ? { _id: new ObjectId(targetId) } : { _id: targetId };

    const passwordHash = await bcrypt.hash(cleanPassword, 10);

    const updateRes = await db.collection("technicians").updateOne(query, {
      $set: {
        passwordHash,
        plainPassword: cleanPassword,
        password: cleanPassword,
        updatedAt: new Date(),
      },
    });

    if (updateRes.matchedCount === 0) {
      return res.status(404).json({ error: "Technician not found" });
    }

    // Invalidate caches
    delPattern("admin:techs:*").catch(() => {});

    return res.json({
      ok: true,
      success: true,
      message: "Password updated successfully",
      newPassword: cleanPassword,
    });
  } catch (err) {
    console.error("Password update error:", err);
    return res.status(500).json({ error: "Failed to update password" });
  }
}

export default requireRole("admin")(handler);
