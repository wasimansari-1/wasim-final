import { getDb } from "../../../lib/api-helpers.js";
import bcrypt from "bcryptjs";
import { signToken } from "../../../lib/auth.js";
import { serialize } from "cookie";

const TEN_YEARS_IN_SECONDS = 60 * 60 * 24 * 365 * 10; // 315360000

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const db = await getDb();
  const tech = await db.collection("technicians").findOne({ username });

  if (!tech) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, tech.password || tech.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken({
    role: "technician",
    username: tech.username,
    id: tech._id.toString(),
  });

  res.setHeader(
    "Set-Cookie",
    serialize("token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: TEN_YEARS_IN_SECONDS,
      secure: process.env.NODE_ENV === "production",
    })
  );

  res.json({
    ok: true,
    user: {
      id: tech._id.toString(),
      username: tech.username,
      role: "technician",
    },
  });
}
