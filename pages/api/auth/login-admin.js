import { signToken } from "../../../lib/auth.js";
import { getDb } from "../../../lib/api-helpers.js";
import bcrypt from "bcryptjs";
import { serialize } from "cookie";

const TEN_YEARS_IN_SECONDS = 60 * 60 * 24 * 365 * 10; // 315360000

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const username = (req.body?.username || "").trim();
    const password = (req.body?.password || "").trim();

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const db = await getDb();
    const admin = await db.collection("admins").findOne({ username });

    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({
      id: admin._id.toString(),
      username: admin.username,
      role: "admin",
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

    return res.status(200).json({
      ok: true,
      message: "Login successful",
      user: {
        id: admin._id.toString(),
        username: admin.username,
        role: "admin",
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
