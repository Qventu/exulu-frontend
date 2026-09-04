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
  /** Monthly cap in EUR, as a customer would set it. */
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
  user_id_: KOSTEN_TEAMS,
};
