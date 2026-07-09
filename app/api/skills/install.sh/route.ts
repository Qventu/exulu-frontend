import { CLIENT_DIRS } from "@/lib/skills/clients";
import { INSTALL_SH_B64 } from "@/lib/skills/install-sh.generated";

export const dynamic = "force-dynamic";

function baseUrlFrom(request: Request): string {
  const h = request.headers;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  // Sanitize: only accept a plain http(s) origin to prevent shell injection via
  // attacker-controlled Host headers when the value is interpolated into sh.
  return /^https?:\/\/[A-Za-z0-9.\-:]+$/.test(origin)
    ? origin
    : new URL(request.url).origin;
}

export async function GET(request: Request) {
  const baseUrl = baseUrlFrom(request).replace(/\/+$/, "");
  // "id:dir" pairs the shell splits; agents first so it's the default.
  const clientPairs = CLIENT_DIRS.map((c) => `${c.id}:${c.dir}`).join(" ");

  // The script is base64-embedded (see the generated module) so no shell
  // escaping is needed here; only the two placeholders are substituted. Both
  // injected values are safe: baseUrl is sanitized above to an http(s) origin
  // (no quotes/metacharacters), and clientPairs comes from our static manifest.
  const script = Buffer.from(INSTALL_SH_B64, "base64")
    .toString("utf8")
    .replace("__BASE_URL__", baseUrl)
    .replace("__CLIENT_PAIRS__", clientPairs);

  return new Response(script, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
