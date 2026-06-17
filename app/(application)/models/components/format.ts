/**
 * formatTokens — humanizes a token-count integer for the table/sheet cells.
 * Returns "—" for null/undefined; "1.2M" for >= 1M, "128K" for >= 1K.
 */
export const formatTokens = (n: number | null | undefined): string => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
};

/**
 * formatCostPerMillion — fixed-2 decimals; renders $0.00 for free models so
 * we don't drop the cell entirely (U15).
 */
export const formatCostPerMillion = (n: number): string => n.toFixed(2);
