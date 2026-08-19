import { getDb, requireRole } from "../../../lib/api-helpers";
import { ObjectId } from "mongodb";
import { delPattern } from "../../../lib/redis.js";

async function handler(req, res) {
  if (req.method !== "DELETE")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { id } = req.query;

    if (!id || !ObjectId.isValid(id))
      return res.status(400).json({ success: false, error: "Invalid ID" });

    const db = await getDb();

    await db.collection("technicians").deleteOne({ _id: new ObjectId(id) });
    delPattern("admin:techs:*").catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE TECH ERROR:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

export default requireRole("admin")(handler);
