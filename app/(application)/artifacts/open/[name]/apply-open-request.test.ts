/**
 * `applyOpenRequest` — the pure orchestrator that turns a validated
 * `OpenPanelRequest` (task 4's wire shape, already parsed and slot-checked by
 * the time it reaches here) into calls against the chat controller. Deps are
 * injected so this is testable with no `ChatSessionController`, no React, no
 * network — exactly the controller methods task 9 adds/reuses:
 * `seedInput`, `addSessionItems`, `addSessionFiles`, `setFilesPanelOpen`.
 *
 * Global constraint this file exists to prove: prefill never submits. There
 * is no `send` dependency in the injected shape at all — not omitted by the
 * test, absent from the type — so a compromised or buggy artifact cannot
 * drive a send under the user's identity through this path.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

import type { OpenPanelRequest } from "@/lib/artifacts/agent-panel-protocol";

import { applyOpenRequest } from "./apply-open-request";

afterEach(() => {
  vi.clearAllMocks();
});

const baseRequest: OpenPanelRequest = {
  type: "exulu:panel:open",
  v: 2,
  slot: "advisor",
};

const makeDeps = () => ({
  seedInput: vi.fn(),
  addSessionItems: vi.fn().mockResolvedValue(undefined),
  addSessionFiles: vi.fn().mockResolvedValue(undefined),
  setFilesPanelOpen: vi.fn().mockResolvedValue(undefined),
});

describe("applyOpenRequest", () => {
  test("prompt text goes through seedInput, and no submit dep is even available", async () => {
    // "No submit dep is even available" is a compile-time fact, not a
    // runtime one: `ApplyOpenRequestDeps` (apply-open-request.ts) declares
    // no send/submit field, and `makeDeps()` below passes exactly its four
    // keys to `applyOpenRequest` — the call site tsc already checks on
    // every run of the typecheck gate. Were a required send capability ever
    // added to that interface, EVERY call to `applyOpenRequest` in this
    // file (this one included) would fail to compile for lacking it, which
    // is the actual guarantee this test's name is pointing at.
    const deps = makeDeps();

    await applyOpenRequest({ ...baseRequest, prompt: "Summarise this filing" }, deps);

    expect(deps.seedInput).toHaveBeenCalledWith("Summarise this filing");
    expect(deps.seedInput).toHaveBeenCalledTimes(1);
  });

  test("items go through addSessionItems", async () => {
    const deps = makeDeps();

    await applyOpenRequest({ ...baseRequest, items: ["ctx-1", "ctx-1/item-2"] }, deps);

    expect(deps.addSessionItems).toHaveBeenCalledWith(["ctx-1", "ctx-1/item-2"]);
  });

  test("files go through addSessionFiles", async () => {
    const deps = makeDeps();

    await applyOpenRequest({ ...baseRequest, files: ["user_1/report.pdf"] }, deps);

    expect(deps.addSessionFiles).toHaveBeenCalledWith(["user_1/report.pdf"]);
  });

  test("the files panel is opened so the user sees what was attached before sending", async () => {
    const deps = makeDeps();

    await applyOpenRequest({ ...baseRequest, files: ["user_1/report.pdf"] }, deps);

    expect(deps.setFilesPanelOpen).toHaveBeenCalledWith(true);
  });

  test("a request with no prompt does not call seedInput", async () => {
    // must not blank a draft the user already typed
    const deps = makeDeps();

    await applyOpenRequest({ ...baseRequest, items: ["ctx-1"] }, deps);

    expect(deps.seedInput).not.toHaveBeenCalled();
  });

  test("an adopt failure still leaves the seeded prompt in place", async () => {
    // addSessionFiles rejects; seedInput was already called and is not
    // reverted — applyOpenRequest seeds first, precisely so a later failure
    // can never cost the user the prompt they came here to review.
    const deps = makeDeps();
    deps.addSessionFiles.mockRejectedValue(new Error("adopt failed"));

    await expect(
      applyOpenRequest(
        { ...baseRequest, prompt: "Summarise this filing", files: ["user_1/report.pdf"] },
        deps,
      ),
    ).rejects.toThrow("adopt failed");

    expect(deps.seedInput).toHaveBeenCalledWith("Summarise this filing");
  });

  test("items and files are both applied when both are present", async () => {
    const deps = makeDeps();

    await applyOpenRequest(
      { ...baseRequest, items: ["ctx-1"], files: ["user_1/report.pdf"] },
      deps,
    );

    expect(deps.addSessionItems).toHaveBeenCalledWith(["ctx-1"]);
    expect(deps.addSessionFiles).toHaveBeenCalledWith(["user_1/report.pdf"]);
  });

  test("no empty-array calls when items/files are absent", async () => {
    const deps = makeDeps();

    await applyOpenRequest({ ...baseRequest, prompt: "hi" }, deps);

    expect(deps.addSessionItems).not.toHaveBeenCalled();
    expect(deps.addSessionFiles).not.toHaveBeenCalled();
    expect(deps.setFilesPanelOpen).not.toHaveBeenCalled();
  });
});
