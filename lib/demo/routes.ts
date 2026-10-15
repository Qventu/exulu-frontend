/**
 * Routes the chapter modules navigate to.
 *
 * Extracted from tour.ts to break a cycle: tour.ts imports CHAPTERS from
 * ./chapters, and the chapter modules need these constants. Type-only imports
 * are erased at compile time and safe in a cycle; runtime values are not.
 */
import { DEMO_AGENT_ID, TECHDOC_SESSION_ID } from "./fixtures/chapter-techdoc";
import { MEMORY_SESSION_ID } from "./fixtures/chapter-memory";
import { ALGI_AGENT_ID, ALGI_ROUTINE_ID, ALGI_SESSION_ID, APPROVAL_RUN_ID } from "./fixtures/chapter-email";

/**
 * The chat chapters run on the product's own route, not a demo-only one.
 *
 * They used to render at /demo/tour — a parallel page that existed only
 * because chapter 1 was built before fetchGraphQLServerSide learned to answer
 * from fixtures. That page carried a SECOND root layout, and it drifted from
 * the real one exactly as lib/graphql/server.ts warned it would: the theme
 * provider went missing from it once, and the OPEN favicon a second time.
 *
 * The session id in the path is what the resolvers key scrollback off, so each
 * chapter opens its own conversation without the route needing to know
 * anything about the tour.
 */
export const TECHDOC_CHAT = `/chat/${DEMO_AGENT_ID}/${TECHDOC_SESSION_ID}`;
export const MEMORY_CHAT = `/chat/${DEMO_AGENT_ID}/${MEMORY_SESSION_ID}`;

/** Chapter 9's last step: ALFREDO's stored session, ending on an approval card. */
export const ALGI_CHAT = `/chat/${ALGI_AGENT_ID}/${ALGI_SESSION_ID}`;

/** Chapter 9's runs step: the routine's runs with the waiting run expanded (`?run=`). */
export const ALGI_RUNS_OPEN = `/workflows/${ALGI_ROUTINE_ID}?run=${APPROVAL_RUN_ID}`;

/**
 * The closing step's booking link — a HubSpot meetings URL.
 *
 * ==> THIS IS THE LAST THING TO SET BEFORE THE DEMO GOES LIVE. <==
 *
 * Empty until that link exists. The closing step reads the emptiness and drops
 * the invitation clause entirely rather than rendering a dead anchor or the
 * word "TO_BE_FILLED" at a prospect — so an unset link costs the tour its ask,
 * which is bad, instead of showing something broken, which is worse.
 *
 * tour.test.ts asserts that behaviour in both directions, so setting this is
 * the only change needed: the link appears, and the copy comes with it.
 */
export const DEMO_BOOKING_URL = "";
