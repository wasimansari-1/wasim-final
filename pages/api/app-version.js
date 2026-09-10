// pages/api/app-version.js
// Returns current server build time so clients can auto-detect updates without manual refresh
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  
  const buildTime = process.env.NEXT_PUBLIC_APP_BUILD_TIME || "dev";

  res.status(200).json({
    buildTime,
    timestamp: Date.now(),
  });
}
