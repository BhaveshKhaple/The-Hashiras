/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  turbopack: {},
  async headers() {
    return [{
      source: "/(.*)",
      headers: [{ key: "Permissions-Policy", value: "microphone=*, geolocation=*, vibrate=*" }],
    }];
  },
};

module.exports = withPWA(nextConfig);
