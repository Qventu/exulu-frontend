/**
 * /login server page (design/pages/auth.md ladder #1).
 *
 * Already-authenticated visitors skip the form: they land on their preserved
 * `?destination` deep link, or "/" — the Home routing rule there sends
 * P1-only accounts to /chat and elevated accounts to Home. (The historical
 * `/dashboard` target no longer exists as a route; "/" is its successor.)
 * Only same-origin paths are honored — never an absolute URL (no open
 * redirect).
 */
import { redirect } from "next/navigation";
import Login from "@/app/(authentication)/login/login";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";

export const dynamic = "force-dynamic";

function safeDestination(raw: string | undefined): string {
  if (!raw) return "/";
  let destination = raw;
  try {
    destination = decodeURIComponent(raw);
  } catch {
    // keep the raw value — same tolerance as the client side
  }
  // Same-origin paths only: must start with "/" but not "//" (protocol-relative).
  if (!destination.startsWith("/") || destination.startsWith("//")) return "/";
  return destination;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string }>;
}) {
  const user = await serverSideAuthCheck();
  if (user) {
    const { destination } = await searchParams;
    redirect(safeDestination(destination));
  }
  return <Login />;
}
