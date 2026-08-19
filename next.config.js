/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Rewrites ensure both files served from root
  async rewrites() {
    return [
      {
        source: "/firebase-messaging-sw.js",
        destination: "/firebase-messaging-sw.js",
      },
      {
        source: "/manifest.json",
        destination: "/manifest.json",
      },
    ];
  },

  // ✅ Add important headers for PWA + Service Worker
  async headers() {
    return [
      // 🔹 Allow service worker to control entire site
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      // 🔹 Set manifest headers so PWA Builder detects it
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
