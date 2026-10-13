import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkoolPro",
    short_name: "SkoolPro",
    description: "School management: attendance, results, fees and communication.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#070b14",
    theme_color: "#10b981",
    icons: [
      { src: "/brand/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
