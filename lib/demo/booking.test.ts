import { describe, expect, it } from "vitest";
import { bookingUrl, DEMO_UTM_SOURCE, stepMedium } from "./booking";
import { DEMO_BOOKING_URL } from "./routes";

describe("bookingUrl", () => {
  it("appends source, medium and campaign to the HubSpot link", () => {
    const url = new URL(bookingUrl("probe-3-monate", "kapitel-12-contact-close"));
    expect(`${url.origin}${url.pathname}`).toBe(DEMO_BOOKING_URL);
    expect(url.searchParams.get("utm_source")).toBe(DEMO_UTM_SOURCE);
    expect(url.searchParams.get("utm_medium")).toBe("kapitel-12-contact-close");
    expect(url.searchParams.get("utm_campaign")).toBe("probe-3-monate");
  });

  it("names the source so HubSpot's 'Quelle der letzten Buchung' reads as the demo", () => {
    expect(DEMO_UTM_SOURCE).toBe("open-imp-demo");
  });

  it("is empty when the base link is empty, so no step renders a dead anchor", () => {
    expect(bookingUrl("tour", "kapitel-01-daten-pile", "")).toBe("");
  });

  it("encodes values rather than trusting them", () => {
    const url = new URL(bookingUrl("a b", "c&d"));
    expect(url.searchParams.get("utm_campaign")).toBe("a b");
    expect(url.searchParams.get("utm_medium")).toBe("c&d");
  });
});

describe("stepMedium", () => {
  it("is the chapter number, two digits, and the step id", () => {
    expect(stepMedium(6, "memory-map")).toBe("kapitel-06-memory-map");
    expect(stepMedium(12, "contact-close")).toBe("kapitel-12-contact-close");
  });
});
