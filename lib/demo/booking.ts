/**
 * The booking link with tracking parameters.
 *
 * HubSpot's scheduling pages do not prefill form questions from the URL, but
 * they do read tracking parameters: when a visitor books through a link that
 * carries them, the values land on the contact as "Quelle / Medium / Kampagne
 * der letzten Buchung im Meetings-Tool". That is how sales learns, without a
 * form question, which offer the visitor picked and where in the tour they
 * were when they clicked:
 *
 *   utm_source   — always the demo (DEMO_UTM_SOURCE)
 *   utm_campaign — "probe-3-monate" for the offer's button in the closing
 *                  scene, "tour" for the panel link that commits to nothing
 *   utm_medium   — the step the click came from (stepMedium)
 */
import { DEMO_BOOKING_URL } from "./routes";

/** What HubSpot shows as the contact's "Quelle der letzten Buchung". */
export const DEMO_UTM_SOURCE = "open-imp-demo";

/**
 * The booking link for one offer from one step. Empty when the base link is
 * empty: routes.ts promises that an unset DEMO_BOOKING_URL renders no anchor
 * at all, and a `?utm_…` on nothing would break that promise.
 */
export function bookingUrl(campaign: string, medium: string, base: string = DEMO_BOOKING_URL): string {
  if (!base) return "";
  const params = new URLSearchParams({ utm_source: DEMO_UTM_SOURCE, utm_medium: medium, utm_campaign: campaign });
  return `${base}?${params.toString()}`;
}

/**
 * The panel's link: campaign "tour", because a click there committed to no
 * offer; the medium still says where.
 */
export function panelBookingUrl(chapterNumber: number, stepId: string): string {
  return bookingUrl("tour", stepMedium(chapterNumber, stepId));
}

/** `kapitel-06-memory-map`: the chapter's number (1-based, two digits) and the step's id. */
export function stepMedium(chapterNumber: number, stepId: string): string {
  return `kapitel-${String(chapterNumber).padStart(2, "0")}-${stepId}`;
}
