/**
 * The teams the cost chapter attributes spend to, and their budgets.
 *
 * ONE source of truth for both screens. /analytics reads these through the
 * REST fixture and /budgets through the GraphQL resolvers; if they were
 * declared twice, the two halves of a single chapter could disagree about
 * who spent what while a prospect looked at them side by side.
 *
 * Generic German functions, never customer names — chapters/index.test.ts
 * asserts NEW Lift and ALGI appear only in contact.ts.
 *
 * THE FIGURES ARE INVENTED. No spend history was captured from the
 * deployment. The chapter says so on screen and a test asserts it keeps
 * saying so; see lib/demo/chapters/kosten.ts.
 */
export interface KostenTeam {
  id: string;
  name: string;
  /** Monthly cap in USD, as a customer would set it. */
  budget: number;
  /** Share of total spend, 0..1. Sums to 1 across the roster. */
  share: number;
}

export const KOSTEN_TEAMS: KostenTeam[] = [
  { id: "team-technik", name: "Technik", budget: 250, share: 0.52 },
  { id: "team-service", name: "Service", budget: 150, share: 0.31 },
  { id: "team-vertrieb", name: "Vertrieb", budget: 100, share: 0.17 },
];

/**
 * Which roster answers a given tag prefix.
 *
 * /analytics asks for one prefix per dimension (lens.ts's
 * DIMENSION_TAG_PREFIX), and its totals/daily queries always slice on
 * `user_id_` (CANONICAL_DEDUPE_TAG_PREFIX). Anything we have no roster for
 * yields an empty breakdown rather than invented entities.
 */
export const KOSTEN_ROSTERS: Record<string, KostenTeam[]> = {
  team_id_: KOSTEN_TEAMS,
};

/**
 * Canonical monthly spend (USD — LiteLLM reports spend in USD and both
 * screens render it as such), allocated across KOSTEN_TEAMS by `share`.
 *
 * Both screens read from this ONE number so their per-team spend agrees by
 * construction rather than by coincidence. /budgets has no date window — it
 * shows the current period's spend against a cap — so its resolvers
 * allocate this constant directly (see resolvers.ts). /analytics' REST
 * fixture (rest-fixtures.ts) sums a day-by-day formula over whatever window
 * the caller requests, since a live chart needs a real window; that formula
 * was tuned so a 30-day window lands roughly near this number, not tightly —
 * measured at ~8% above it on one check (a day-generator sum drifts with the
 * date it runs on, so the gap moves rather than holding still) — which is
 * the figure the chapter was designed around.
 *
 * The three budget caps (250/150/100) were sized against this total so that
 * Technik and Service both cross the 80%-used warning band and Vertrieb
 * stays clear — /budgets' "at risk" section has something to show, which a
 * flat `spend: 0` silently defeated until this constant existed.
 */
export const KOSTEN_MONTHLY_SPEND = 400;

/**
 * Split `total` proportionally across `shares` using largest-remainder
 * (Hamilton) apportionment: floor every share, then hand the leftover units
 * one at a time to the shares with the largest fractional remainder.
 *
 * Rounding each share independently (`Math.round`) can miss the total by a
 * unit — e.g. 0.52/0.31/0.17 of 41603 rounds to parts that sum to 41604.
 * This chapter's entire argument is attribution: a prospect who adds the
 * team figures back up must land exactly on the total.
 */
function allocateProportional(total: number, shares: number[]): number[] {
  if (shares.length === 0) return [];
  const raw = shares.map((s) => total * s);
  const floors = raw.map((r) => Math.floor(r));
  const remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < remainder; k++) {
    out[order[k % order.length].i] += 1;
  }
  return out;
}

/**
 * USD amounts (2dp) that split `total` across `shares` and sum to it
 * exactly. Shared by rest-fixtures.ts and resolvers.ts so both allocate
 * spend the same way, whatever total each one is allocating.
 */
export function allocateSpend(total: number, shares: number[]): number[] {
  const totalCents = Math.round(total * 100);
  return allocateProportional(totalCents, shares).map((c) => c / 100);
}
