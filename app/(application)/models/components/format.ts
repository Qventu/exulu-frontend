import { spendCurrency } from "@/lib/spend-currency";

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
 * formatCostPerMillion — the per-million-token price as currency, in the
 * display currency spend uses everywhere else (USD in the product, EUR in
 * the demo — lib/spend-currency.ts). Two decimals always, so a free model
 * renders $0.00 rather than dropping the cell (U15). The "/M" suffix is the
 * `models.cost.perMillion` message's business, not this helper's.
 */
export const formatCostPerMillion = (
  n: number,
  { currency, locale }: { currency: "USD" | "EUR"; locale: string } = spendCurrency(),
): string =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
