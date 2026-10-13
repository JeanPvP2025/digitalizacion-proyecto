import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "thumb.pccomponentes.com", pathname: "/articles/**" },
      { protocol: "https", hostname: "thumb.pccomponentes.com", pathname: "/w-*/articles/**" },
      { protocol: "https", hostname: "img.pccomponentes.com", pathname: "/articles/**" },
    ],
  },
};

export default nextConfig;
