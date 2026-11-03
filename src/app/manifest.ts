import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finansial",
    short_name: "Finansial",
    description: "Household money tracker backed by Google Sheets",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f7",
    theme_color: "#3392ff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
