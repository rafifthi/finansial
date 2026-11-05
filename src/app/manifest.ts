import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finansial",
    short_name: "Finansial",
    description: "Household money tracker backed by Google Sheets",
    start_url: "/",
    display: "standalone",
    background_color: "#0f3d33",
    theme_color: "#0f3d33",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Full-bleed for Android launchers that crop to their own shape.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
