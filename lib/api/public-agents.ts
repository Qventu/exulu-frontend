import type { PublicAgentAuthMode } from "@/lib/public-agents/gate";

export interface PublicAgentMeta {
  id: string;
  name: string;
  description: string;
  image: string | null;
  welcomemessage: string;
  slug: string;
  guest_auth_mode: PublicAgentAuthMode;
  guest_has_cover: boolean;
}

const backend = () => process.env.BACKEND || "";

/** Server-side list of guest-enabled agents. null = backend unreachable. */
export async function fetchPublicAgents(): Promise<PublicAgentMeta[] | null> {
  if (!backend()) return null;
  try {
    const res = await fetch(`${backend()}/public-agents`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublicAgentMeta[];
  } catch {
    return null;
  }
}

export async function fetchPublicAgentMeta(
  id: string,
): Promise<PublicAgentMeta | "notfound" | null> {
  if (!backend()) return null;
  try {
    const res = await fetch(
      `${backend()}/public-agents/${encodeURIComponent(id)}/meta`,
      { cache: "no-store" },
    );
    if (res.status === 404) return "notfound";
    if (!res.ok) return null;
    return (await res.json()) as PublicAgentMeta;
  } catch {
    return null;
  }
}

export async function verifyGuestPassword(
  id: string,
  password: string,
): Promise<boolean> {
  if (!backend()) return false;
  try {
    const res = await fetch(
      `${backend()}/public-agents/${encodeURIComponent(id)}/verify-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      },
    );
    return res.status === 204;
  } catch {
    return false;
  }
}
