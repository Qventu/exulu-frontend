import { describe, test, expect } from "vitest";

import {
  CHANNEL_V,
  parseOpenPanelRequest,
  hostInfo,
  panelViewport,
  turnProgress,
  openPanelAck,
} from "./agent-panel-protocol";

describe("parseOpenPanelRequest", () => {
  test("accepts a minimal request", () => {
    expect(parseOpenPanelRequest({ type: "exulu:panel:open", v: 2, slot: "analyse" })).toEqual({
      type: "exulu:panel:open",
      v: 2,
      slot: "analyse",
    });
  });

  test("carries prompt, items and files through", () => {
    const input = {
      type: "exulu:panel:open",
      v: 2,
      slot: "analyse",
      prompt: "Summarize this",
      items: ["item-1", "item-2"],
      files: ["file-1"],
    };
    expect(parseOpenPanelRequest(input)).toEqual(input);
  });

  test("rejects a wrong version", () => {
    expect(parseOpenPanelRequest({ type: "exulu:panel:open", v: 1, slot: "a" })).toBeNull();
  });

  test("rejects a wrong type, a missing slot, and a non-string slot", () => {
    expect(parseOpenPanelRequest({ type: "exulu:panel:openz", v: 2, slot: "a" })).toBeNull();
    expect(parseOpenPanelRequest({ type: "exulu:panel:open", v: 2 })).toBeNull();
    expect(parseOpenPanelRequest({ type: "exulu:panel:open", v: 2, slot: 7 })).toBeNull();
  });

  test("rejects non-string entries inside items/files rather than passing them on", () => {
    expect(
      parseOpenPanelRequest({ type: "exulu:panel:open", v: 2, slot: "a", files: ["ok", 7] }),
    ).toBeNull();
    expect(
      parseOpenPanelRequest({ type: "exulu:panel:open", v: 2, slot: "a", items: ["ok", null] }),
    ).toBeNull();
  });

  test("drops unknown properties", () => {
    const r = parseOpenPanelRequest({
      type: "exulu:panel:open",
      v: 2,
      slot: "a",
      evil: 1,
    } as unknown);
    expect(r && "evil" in r).toBe(false);
  });

  test("rejects non-object and null input", () => {
    expect(parseOpenPanelRequest(null)).toBeNull();
    expect(parseOpenPanelRequest(undefined)).toBeNull();
    expect(parseOpenPanelRequest("exulu:panel:open")).toBeNull();
    expect(parseOpenPanelRequest(42)).toBeNull();
  });

  test("rejects a non-string prompt", () => {
    expect(
      parseOpenPanelRequest({ type: "exulu:panel:open", v: 2, slot: "a", prompt: 7 }),
    ).toBeNull();
  });

  test("rejects items/files that are not arrays", () => {
    expect(
      parseOpenPanelRequest({ type: "exulu:panel:open", v: 2, slot: "a", items: "not-an-array" }),
    ).toBeNull();
    expect(
      parseOpenPanelRequest({ type: "exulu:panel:open", v: 2, slot: "a", files: "not-an-array" }),
    ).toBeNull();
  });
});

test("the builders stamp CHANNEL_V", () => {
  expect(hostInfo(true, []).v).toBe(CHANNEL_V);
  expect(panelViewport(640, true).v).toBe(CHANNEL_V);
  expect(turnProgress("turn").v).toBe(CHANNEL_V);
});

describe("builders carry their fields through", () => {
  test("hostInfo carries the panel flag and slots through", () => {
    const slots = [{ key: "analyse", label: "Analyse" }];
    expect(hostInfo(true, slots)).toEqual({
      type: "exulu:host:info",
      v: CHANNEL_V,
      panel: true,
      slots,
    });
    expect(hostInfo(false, [])).toEqual({
      type: "exulu:host:info",
      v: CHANNEL_V,
      panel: false,
      slots: [],
    });
  });

  test("panelViewport carries width and open through", () => {
    expect(panelViewport(640, true)).toEqual({
      type: "exulu:panel:viewport",
      v: CHANNEL_V,
      width: 640,
      open: true,
    });
    expect(panelViewport(0, false)).toEqual({
      type: "exulu:panel:viewport",
      v: CHANNEL_V,
      width: 0,
      open: false,
    });
  });

  test("turnProgress carries the reason through", () => {
    expect(turnProgress("tool")).toEqual({ type: "exulu:session:progress", v: CHANNEL_V, reason: "tool" });
    expect(turnProgress("turn")).toEqual({ type: "exulu:session:progress", v: CHANNEL_V, reason: "turn" });
  });
});

describe("openPanelAck", () => {
  test("stamps CHANNEL_V and carries slot and accepted through", () => {
    expect(openPanelAck("analyse", true)).toEqual({
      type: "exulu:panel:open:ack",
      v: CHANNEL_V,
      slot: "analyse",
      accepted: true,
    });
  });

  test("includes reason only when given", () => {
    expect(openPanelAck("analyse", false, "no such slot")).toEqual({
      type: "exulu:panel:open:ack",
      v: CHANNEL_V,
      slot: "analyse",
      accepted: false,
      reason: "no such slot",
    });
  });
});
