/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  // DISP-004 fix: removed empty turbopack:{} — was causing potential route group resolution issues
  async headers() {
    return [{
      source: "/(.*)",
      headers: [{ key: "Permissions-Policy", value: "microphone=*, geolocation=*, vibrate=*" }],
    }];
  },
};

module.exports = withPWA(nextConfig);

