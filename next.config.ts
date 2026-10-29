import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    // Local technical SVGs are served as static vector assets with unoptimized={true}.
    // dangerouslyAllowSVG is disabled to prevent SVG ingestion vulnerabilities.
    dangerouslyAllowSVG: false,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "thumb.pccomponentes.com", pathname: "/articles/**" },
      { protocol: "https", hostname: "thumb.pccomponentes.com", pathname: "/w-*/articles/**" },
      { protocol: "https", hostname: "img.pccomponentes.com", pathname: "/articles/**" },
    ],
  },
};

export default nextConfig;
