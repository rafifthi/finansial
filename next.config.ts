import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads live sheet data behind a login, so there is nothing to
  // prerender; Cache Components stays off to keep rendering fully dynamic.
  cacheComponents: false,
  experimental: {
    // Bill screenshots are sent to a server action (downscaled on the client first).
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
