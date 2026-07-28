import type { MetadataRoute } from "next";

const teamName = process.env.NEXT_PUBLIC_TEAM_NAME || "Your Team";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: siteUrl,
    name: "Catarina",
    short_name: "Catarina",
    description: `Team planning and progress tracking for ${teamName}.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#060B14",
    theme_color: "#00E8A2",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: "Dashboard",
        url: "/dashboard",
        description: "View team planning dashboard",
      },
    ],
  };
}
