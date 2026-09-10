// server.js
// Custom Next.js + Express server to serve persistent uploads
// Usage: NODE_ENV=production node server.js
const express = require("express");
const next = require("next");
const path = require("path");
const fs = require("fs");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// In production we serve uploads from this persistent folder (create on VPS)
const PROD_UPLOADS_DIR = process.env.UPLOADS_DIR || "/var/www/chimney-uploads";
// In development use project public/uploads for convenience
const DEV_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

// Choose folder based on environment
const UPLOADS_DIR = dev ? DEV_UPLOADS_DIR : PROD_UPLOADS_DIR;

app.prepare().then(() => {
  const server = express();

  // Ensure folder exists
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      console.log("Created uploads dir:", UPLOADS_DIR);
    }
  } catch (e) {
    console.warn("Could not ensure uploads dir:", e.message || e);
  }

  // Serve uploads statically at /uploads
  server.use(
    "/uploads",
    express.static(UPLOADS_DIR, {
      maxAge: "365d",
      immutable: true,
    })
  );

  // Next handler for all other routes (prevent stale UI caching on iOS & browsers)
  server.all("*", (req, res) => {
    if (!req.path.startsWith("/_next/static/") && !req.path.startsWith("/uploads/")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    return handle(req, res);
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT} (dev=${dev})`);
    console.log(`> Serving uploads from ${UPLOADS_DIR}`);
  });
});
