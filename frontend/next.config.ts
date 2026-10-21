import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Do not show the Next.js development badge over product UI previews.
  devIndicators: false,
  // Explicitly allow the second loopback hostname in local Next.js Dev.
  allowedDevOrigins: ["127.0.0.1"],
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
