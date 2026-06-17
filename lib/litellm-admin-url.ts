/**
 * LiteLLM Admin UI URL resolver.
 *
 * Extracted from app/(application)/models/components/litellm-catalog-view.tsx
 * so both /models and /analytics can link to the same URL without forking
 * the fallback / trailing-slash logic. Behavior is byte-for-byte equivalent
 * to the inline computation that previously lived in litellm-catalog-view.tsx.
 *
 * LiteLLM Admin UI lives on the LiteLLM port (default 4000), on the same
 * host as the backend. If the dev is using a non-standard layout they can
 * override via env; this helper does not expose that knob.
 */
export function getLiteLLMAdminUrl(backend: string | null | undefined): string {
  const base = backend ?? "";
  try {
    const url = new URL(base);
    url.pathname = "/litellm-admin/ui";
    return url.toString();
  } catch {
    return `${base.replace(/\/$/, "")}/litellm-admin/ui`;
  }
}
