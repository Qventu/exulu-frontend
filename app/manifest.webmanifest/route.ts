import { NextResponse } from "next/server";

// Request-time env: the package ships prebuilt, so a static route would
// bake in the empty build-time BACKEND/APP_NAME values.
export const dynamic = "force-dynamic";

// Served from the frontend origin because browsers reject cross-origin
// manifests. The icon inside may point at the backend, same as the logos:
// clients drop favicon.png into the public/ folder their backend serves.
// One 512px icon satisfies Edge/Chrome installability (>=144px), which is
// what produces the Windows taskbar / home-screen icon.
export async function GET() {
  const backend = process.env.BACKEND || "";
  const name = process.env.APP_NAME || "IMP";
  return NextResponse.json(
    {
      name,
      short_name: name,
      start_url: "/",
      display: "standalone",
      icons: [
        {
          src: `${backend}/favicon.png`,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
