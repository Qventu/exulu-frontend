import { beforeEach, describe, expect, it } from "vitest";
import {
  clearTranscript,
  loadTranscript,
  saveTranscript,
} from "@/lib/public-agents/transcript-store";

// vitest node env: emulate localStorage.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const msg = (id: string) => ({
  id,
  role: "user",
  parts: [{ type: "text", text: `m${id}` }],
});

describe("transcript store", () => {
  it("round-trips messages per agent", () => {
    saveTranscript("a1", [msg("1")] as any);
    saveTranscript("a2", [msg("2")] as any);
    expect(loadTranscript("a1")).toHaveLength(1);
    expect(loadTranscript("a1")[0].id).toBe("1");
    expect(loadTranscript("a2")[0].id).toBe("2");
  });

  it("returns [] for unknown agents and corrupt data", () => {
    expect(loadTranscript("nope")).toEqual([]);
    (globalThis as any).localStorage.setItem("exulu_public_chat_bad", "{not json");
    expect(loadTranscript("bad")).toEqual([]);
  });

  it("caps stored messages at 50 (keeps the newest)", () => {
    const many = Array.from({ length: 60 }, (_, i) => msg(String(i)));
    saveTranscript("a1", many as any);
    const loaded = loadTranscript("a1");
    expect(loaded).toHaveLength(50);
    expect(loaded[0].id).toBe("10");
    expect(loaded[49].id).toBe("59");
  });

  it("clearTranscript removes the entry", () => {
    saveTranscript("a1", [msg("1")] as any);
    clearTranscript("a1");
    expect(loadTranscript("a1")).toEqual([]);
  });

  it("is a no-op without localStorage (SSR safety)", () => {
    delete (globalThis as any).localStorage;
    expect(() => saveTranscript("a1", [msg("1")] as any)).not.toThrow();
    expect(loadTranscript("a1")).toEqual([]);
  });
});
