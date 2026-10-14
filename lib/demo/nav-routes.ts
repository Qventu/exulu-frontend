/**
 * The product areas the guided tour visits, by top-level route.
 *
 * The demo user is a super-admin, so the sidebar would offer all 23 areas —
 * fourteen of them with nothing behind them but the "nicht Teil der Demo"
 * notice. A prospect reads that as a half-finished product. The shell
 * filters its entries to this set in demo mode (D4); the command palette
 * goes through the same function.
 *
 * Static on purpose, and tested against the chapters in both directions
 * (lib/demo/nav-routes.test.ts): the shell must never import the chapter
 * modules, and the list must never drift from the tour. Sub-project 5
 * adds /memory and /models here when its chapters land.
 */
export const DEMO_NAV_ROUTES: ReadonlySet<string> = new Set([
  "/",
  "/chat",
  "/data",
  "/agents",
  "/evals",
  "/workflows",
  "/transcriptions",
  "/analytics",
  "/budgets",
]);
