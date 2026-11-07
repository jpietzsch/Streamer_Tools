import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework in every response (the X-Powered-By header).
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No other site may show these pages inside a frame (blocks clickjacking).
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          // Links to other sites only reveal the domain, not the exact page, and nothing over plain HTTP.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The tools never need these browser features, so switch them off.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
