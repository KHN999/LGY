import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LGY Shop",
    short_name: "LGY",
    description: "Theingyi market longyi management",
    start_url: "/staff",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#059669",
    icons: [
      // SVG works for the standalone app icon. For the Android install prompt,
      // also drop icon-192.png and icon-512.png into /public (then add them here).
      { src: "/logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
