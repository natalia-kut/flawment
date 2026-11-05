import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
