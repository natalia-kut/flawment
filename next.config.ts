import type { NextConfig } from "next";

/**
 * Basic hardening for every page. The policy restricts what does not depend on
 * Next's own inline scripts: framing (only by this site, for the PDF preview),
 * plugins, the base URL and where forms may post. File routes set their own,
 * stricter headers.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Browsers honour it only over HTTPS, so it is harmless on plain http in development.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js": it only tells others what to look for.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/((?!api/).*)", headers: securityHeaders }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  // Keep the dev indicator clear of the Flawiusz launcher in the bottom-right corner.
  devIndicators: { position: "top-right" },
  turbopack: {
    rules: {
      // Tailwind processes the global entry only; CSS Modules use Next.js handling.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
