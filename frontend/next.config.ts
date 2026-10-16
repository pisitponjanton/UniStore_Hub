import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Explicitly allow the second loopback hostname in local Next.js Dev.
  allowedDevOrigins: ["127.0.0.1"],
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
