export interface RetrievalMetrics {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
}

const nf = new Intl.NumberFormat("en-US");

/** One-line benchmark summary for an agentic-retrieval result, or null when there are no usable metrics. */
export function formatRetrievalMetrics(metrics: RetrievalMetrics | null | undefined): string | null {
  if (!metrics || typeof metrics !== "object") return null;
  const { inputTokens, outputTokens, durationMs } = metrics;
  const hasTokens = typeof inputTokens === "number" || typeof outputTokens === "number";
  const hasTime = typeof durationMs === "number";
  if (!hasTokens && !hasTime) return null;
  const parts: string[] = [];
  if (hasTokens) parts.push(`${nf.format(inputTokens ?? 0)} in / ${nf.format(outputTokens ?? 0)} out tokens`);
  if (hasTime) parts.push(`${(Math.max(0, durationMs!) / 1000).toFixed(1)} s`);
  return `↳ retrieval · ${parts.join(" · ")}`;
}
