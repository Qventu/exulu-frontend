// @vitest-environment jsdom
/**
 * The composer's half of the controller seed channel (task 9,
 * artifact-agent-panel plan) — see hooks-seed-input.test.tsx for the
 * controller's own state machine (seedInput/consumePendingInput/nonce) and
 * the doc comment on `ChatSessionController.pendingInput` in hooks.ts for
 * why this channel exists at all, separate from the `?q=` deep link.
 *
 * composer.tsx had no mount harness before this file (composer-send-gate.
 * test.ts asserts against the source instead, for exactly this reason — see
 * its header comment). This one is built narrow and mocked heavily: the
 * controller is a plain object fixture (never the real useChatSession), and
 * `guestMode` is true so the ＋ menu, capability sheet, prompt selector,
 * knowledge modal and save-preset overlay — none of which this file is
 * about — never mount at all. What's left and real: the textarea, the
 * pending-seed effect, and ContextBanner/PinnedContextRow/AutocompleteMenu/
 * HighlightOverlay, all of which render inertly off an empty-knowledge,
 * ok-context, closed-menu controller.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import de from "@/messages/de.json";
import { ConfigContext, type ConfigContextType } from "@/components/shell/config-context";
import { LanguageProvider } from "@/components/shell/language-provider";
import { UserContext } from "@/app/(application)/authenticated";
import type { Agent } from "@/types/models/agent";
import type { ChatSessionController } from "../hooks";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/demo/flag", () => ({ isDemoMode: vi.fn(() => false) }));

// Composer (directly) and useComposerAutocomplete (one hop down) both call
// into @apollo/client; neither query/mutation ever needs to resolve for
// this file, so every hook is a stable, inert stub.
vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: undefined, loading: false })),
    useMutation: vi.fn(() => [vi.fn().mockResolvedValue({}), { loading: false }]),
    useLazyQuery: vi.fn(() => [vi.fn().mockResolvedValue({}), { data: undefined }]),
  };
});

import { Composer } from "./composer";

const AGENT: Agent = {
  id: "agent-1",
  type: "agent",
  name: "Agent",
  slug: "/agents/run",
  model: "gpt-x",
  suggestions_enabled: false,
};

const CONFIG = {
  backend: "http://backend/",
  google_client_id: "",
  auth_mode: "regular",
} as ConfigContextType;

/** A full, real-typed `ChatSessionController` fixture — no `as never`/`as
 *  any`: every field is given a value of its own declared type, so a future
 *  required field left out fails the typecheck instead of being silently
 *  cast away (feedback_typecheck_count_is_equality.md). */
function baseController(overrides: Partial<ChatSessionController> = {}): ChatSessionController {
  return {
    agent: AGENT,
    session: null,
    writeAccess: true,
    creatorEmail: undefined,
    messages: [],
    status: "ready",
    catchingUp: false,
    sendUserMessage: vi.fn().mockResolvedValue(undefined),
    sendQuestionAnswer: vi.fn(),
    stop: vi.fn(),
    regenerate: vi.fn(),
    setMessages: vi.fn(),
    addToolApprovalResponse: vi.fn(),
    ensureSession: vi.fn().mockResolvedValue(null),
    error: null,
    errorRaw: null,
    clearError: vi.fn(),
    tokenCounts: {
      totalTokens: 0,
      reasoningTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
    },
    maxInputLength: 4000,
    modelOverride: null,
    setModelOverride: vi.fn(),
    disabledTools: [],
    toggleTool: vi.fn(),
    enableAll: vi.fn(),
    disableAll: vi.fn(),
    preApprovedTools: [],
    approveToolForChat: vi.fn(),
    revokePreApprovedTool: vi.fn(),
    sessionItems: null,
    addSessionItems: vi.fn().mockResolvedValue(undefined),
    removeSessionItem: vi.fn().mockResolvedValue(undefined),
    replaceSessionItems: vi.fn().mockResolvedValue(undefined),
    fileItems: null,
    addFileItem: vi.fn(),
    removeFileItem: vi.fn(),
    suggestions: [],
    filesPanelOpen: false,
    setFilesPanelOpen: vi.fn().mockResolvedValue(undefined),
    sessionFilesCount: null,
    addSessionFiles: vi.fn().mockResolvedValue(undefined),
    pendingInput: null,
    seedInput: vi.fn(),
    consumePendingInput: vi.fn(),
    memoryPanelOpen: false,
    setMemoryPanelOpen: vi.fn(),
    myMemoriesCount: null,
    budgetExceeded: false,
    managedContextEnabled: false,
    contextWindow: null,
    contextOccupancy: 0,
    contextState: "ok",
    compacting: false,
    compactConversation: vi.fn().mockResolvedValue(false),
    claimChecks: {},
    ...overrides,
  };
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConfigContext.Provider value={CONFIG}>
      <UserContext.Provider value={{ user: { id: 1 } }}>
        <LanguageProvider initialLocale="de" initialMessages={de}>
          {children}
        </LanguageProvider>
      </UserContext.Provider>
    </ConfigContext.Provider>
  );
}

const inputAriaLabel = de.chat.composer.inputAriaLabel;

const show = (controller: ChatSessionController) =>
  render(
    <Wrapper>
      <Composer controller={controller} guestMode />
    </Wrapper>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Composer — pending seed", () => {
  test("a pending seed lands in the textarea and is consumed", () => {
    const controller = baseController({
      pendingInput: { text: "Summarise this filing", nonce: 1 },
    });

    render(
      <Wrapper>
        <Composer controller={controller} guestMode />
      </Wrapper>,
    );

    const textarea = screen.getByLabelText(inputAriaLabel) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Summarise this filing");
    expect(controller.consumePendingInput).toHaveBeenCalledTimes(1);
  });

  test("a second seed replaces the textarea content", () => {
    const controller = baseController({
      pendingInput: { text: "First prompt", nonce: 1 },
    });
    const { rerender } = render(
      <Wrapper>
        <Composer controller={controller} guestMode />
      </Wrapper>,
    );
    const textarea = screen.getByLabelText(inputAriaLabel) as HTMLTextAreaElement;
    expect(textarea.value).toBe("First prompt");

    // Same component instance, a FRESH controller fixture (distinct mock
    // functions — see the "SAME text" test below for why reusing the first
    // controller's would hide a bug) carrying a new nonce — exactly what a
    // second artifact-panel button click produces on the real controller
    // (seedInput bumps the nonce even for identical text; here the text
    // differs too, which is the easier half to see).
    const second = baseController({
      pendingInput: { text: "Second prompt", nonce: 2 },
    });
    act(() => {
      rerender(
        <Wrapper>
          <Composer controller={second} guestMode />
        </Wrapper>,
      );
    });

    expect(textarea.value).toBe("Second prompt");
    expect(second.consumePendingInput).toHaveBeenCalledTimes(1);
  });

  test("seeding twice with the SAME text still reaches the composer", () => {
    // The nonce, not the text, is what the effect is keyed on — a value
    // comparison on text alone would see "First prompt" === "First prompt"
    // and wrongly skip the second application.
    const controller = baseController({
      pendingInput: { text: "First prompt", nonce: 1 },
    });
    const { rerender } = render(
      <Wrapper>
        <Composer controller={controller} guestMode />
      </Wrapper>,
    );
    const textarea = screen.getByLabelText(inputAriaLabel) as HTMLTextAreaElement;

    // The user clears/edits the field between the two clicks.
    fireEvent.change(textarea, { target: { value: "" } });
    expect(textarea.value).toBe("");

    const second = baseController({
      pendingInput: { text: "First prompt", nonce: 2 },
    });
    act(() => {
      rerender(
        <Wrapper>
          <Composer controller={second} guestMode />
        </Wrapper>,
      );
    });

    expect(textarea.value).toBe("First prompt");
    expect(second.consumePendingInput).toHaveBeenCalledTimes(1);
  });

  test("a seed never submits — no send mutation fires", () => {
    const controller = baseController({
      pendingInput: { text: "Summarise this filing", nonce: 1 },
    });

    render(
      <Wrapper>
        <Composer controller={controller} guestMode />
      </Wrapper>,
    );

    const textarea = screen.getByLabelText(inputAriaLabel) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Summarise this filing");
    expect(controller.sendUserMessage).not.toHaveBeenCalled();
  });

  test("a null pendingInput leaves a user draft untouched", () => {
    const controller = baseController({ pendingInput: null });
    const { rerender } = render(
      <Wrapper>
        <Composer controller={controller} guestMode />
      </Wrapper>,
    );
    const textarea = screen.getByLabelText(inputAriaLabel) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "My own draft" } });
    expect(textarea.value).toBe("My own draft");

    // An unrelated re-render (new controller object, pendingInput still
    // null) must not touch what the user typed.
    const unrelated = baseController({ pendingInput: null });
    act(() => {
      rerender(
        <Wrapper>
          <Composer controller={unrelated} guestMode />
        </Wrapper>,
      );
    });

    expect(textarea.value).toBe("My own draft");
    expect(unrelated.consumePendingInput).not.toHaveBeenCalled();
  });
});
