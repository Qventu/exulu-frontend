import { describe, expect, it, vi } from "vitest";

import {
  notifySessionActivityChanged,
  subscribeToSessionActivity,
} from "./session-activity-signal";

describe("session activity signal", () => {
  it("tells a subscriber that something changed", () => {
    const listener = vi.fn();
    subscribeToSessionActivity(listener);

    notifySessionActivityChanged();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tells every subscriber, so rail and sheet both refresh", () => {
    const rail = vi.fn();
    const sheet = vi.fn();
    subscribeToSessionActivity(rail);
    subscribeToSessionActivity(sheet);

    notifySessionActivityChanged();

    expect(rail).toHaveBeenCalledTimes(1);
    expect(sheet).toHaveBeenCalledTimes(1);
  });

  it("stops telling an unsubscribed listener", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionActivity(listener);

    unsubscribe();
    notifySessionActivityChanged();

    expect(listener).not.toHaveBeenCalled();
  });

  it("survives a listener that throws, so one bad subscriber cannot block the rest", () => {
    const broken = vi.fn(() => {
      throw new Error("render blew up");
    });
    const healthy = vi.fn();
    subscribeToSessionActivity(broken);
    subscribeToSessionActivity(healthy);

    expect(() => notifySessionActivityChanged()).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});
