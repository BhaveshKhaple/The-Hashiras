/** @type {import('next').NextConfig} */
const path = require("path");

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  // Fix: pin workspace root so Next.js doesn't get confused by multiple
  // package-lock.json files in sibling dirs (gsd/, backend/).
  // Without this, /_next/static/ assets 404 → "missing required error components"
  outputFileTracingRoot: path.join(__dirname, "../"),

  // DISP-004 fix: removed empty turbopack:{}
  async headers() {
    return [{
      source: "/(.*)",
      headers: [{ key: "Permissions-Policy", value: "microphone=*, geolocation=*, vibrate=*" }],
    }];
  },
};

module.exports = withPWA(nextConfig);


