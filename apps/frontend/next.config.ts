import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow backend API and WebSocket connections
  async rewrites() {
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    // Ensure URL has protocol
    if (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
      apiUrl = `https://${apiUrl}`;
    }
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
