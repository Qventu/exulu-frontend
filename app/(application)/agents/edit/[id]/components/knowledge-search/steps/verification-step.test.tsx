// @vitest-environment jsdom
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { GET_AGENT_LITELLM_CATALOG } from "@/app/(application)/agents/queries";
import de from "@/messages/de.json";

import { defaultWizardConfig, type WizardConfig } from "../config-schema";
import { nextThresholds, VerificationStep } from "./verification-step";

// vitest.config.ts sets no `test.globals`, so testing-library's implicit
// afterEach(cleanup) never registers.
afterEach(cleanup);

beforeAll(() => {
  // Radix's Slider observes its own size and jsdom 26 has no ResizeObserver
  // (same stub as components/widgets/context-map/context-map-card.test.tsx).
  // A no-op is enough: nothing here drags a thumb, it asserts the control's
  // kind, range and label.
  if (!("ResizeObserver" in window)) {
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  }
});

const catalogMock: MockedResponse = {
  request: { query: GET_AGENT_LITELLM_CATALOG },
  result: {
    data: {
      litellmCatalog: [
        {
          model_name: "vertex-gemini-3-flash",
          active: true,
          upstream_model: "gemini-3-flash",
          type: "chat",
          tags: [],
          brand: "google",
          region: "eu",
          max_tokens: 8192,
          max_input_tokens: 1000000,
          max_output_tokens: 8192,
          supports_vision: true,
          supports_function_calling: true,
          supports_pdf_input: true,
          supports_audio_input: false,
          input_cost_per_million_tokens: 1,
          output_cost_per_million_tokens: 2,
          __typename: "LiteLLMModel",
        },
      ],
    },
  },
};

function renderStep(mutate: (cfg: WizardConfig) => void = () => {}) {
  const draft = defaultWizardConfig();
  mutate(draft);
  return render(
    <MockedProvider mocks={[catalogMock]} addTypename={false}>
      <NextIntlClientProvider locale="de" messages={de as never}>
        <VerificationStep draft={draft} setDraft={() => {}} />
      </NextIntlClientProvider>
    </MockedProvider>,
  );
}

describe("nextThresholds", () => {
  // score.ts tests `share >= alert` before `share >= warn`, so an inverted
  // pair makes "warn" unreachable and a flagged answer jumps straight to the
  // red alert shield — a harsher verdict than the admin set.
  it("holds warn <= alert by stopping the dragged handle at the other one", () => {
    expect(nextThresholds({ warn: 0.1, alert: 0.3 }, { warn: 0.9 })).toEqual({ warn: 0.3, alert: 0.3 });
    expect(nextThresholds({ warn: 0.1, alert: 0.3 }, { alert: 0.05 })).toEqual({ warn: 0.1, alert: 0.1 });
  });

  it("leaves an in-order edit exactly as given, and never moves the other handle", () => {
    expect(nextThresholds({ warn: 0.1, alert: 0.3 }, { warn: 0.25 })).toEqual({ warn: 0.25, alert: 0.3 });
    expect(nextThresholds({ warn: 0.1, alert: 0.3 }, { alert: 0.6 })).toEqual({ warn: 0.1, alert: 0.6 });
  });

  it("allows the equal pair and both ends of the range", () => {
    expect(nextThresholds({ warn: 0, alert: 1 }, { warn: 1 })).toEqual({ warn: 1, alert: 1 });
    expect(nextThresholds({ warn: 0.5, alert: 0.5 }, { alert: 0 })).toEqual({ warn: 0.5, alert: 0.5 });
  });

  it("is a no-op for an empty patch", () => {
    const prev = { warn: 0.1, alert: 0.3 };
    expect(nextThresholds(prev, {})).toBe(prev);
  });
});

describe("VerificationStep thresholds", () => {
  // The old control was a number Input, which accepted any finite value: an
  // admin reading "Warnschwelle" with no unit and typing 20 for 20% saved a
  // blob the backend threw away wholesale (enabled: false included), and one
  // backspace set warn: 0, which paints the orange warn shield on a
  // 4-of-4-supported answer. A slider cannot hold either state.
  it("renders each threshold as a slider, not a free number field", () => {
    renderStep();
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    // Radix renders one role="slider" thumb per value.
    expect(screen.getAllByRole("slider")).toHaveLength(2);
  });

  it("labels each threshold with its value as a percent share", () => {
    renderStep((cfg) => {
      cfg.claimCheck.thresholds = { warn: 0.15, alert: 0.4 };
    });
    expect(screen.getByText("Warnschwelle: 15%")).toBeDefined();
    expect(screen.getByText("Alarmschwelle: 40%")).toBeDefined();
  });

  it("says what the number is a share of", () => {
    renderStep();
    expect(screen.getByText(/Anteil der geprüften Aussagen/)).toBeDefined();
  });
});

describe("VerificationStep model field", () => {
  // A free-text Input let a typo become a permanent failure line: an
  // unresolvable model id makes the endpoint answer 400 by design, so
  // "Die Prüfung konnte nicht abgeschlossen werden." renders under every
  // answer of that agent, forever, with nothing pointing at the typo.
  it("offers the model catalogue instead of a free-text field", async () => {
    renderStep();
    // No textbox at all in this step — the picker's own search field lives
    // inside the (closed) dropdown content.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    // AgentModelSelector renders a Radix Select trigger (role combobox).
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(1);
  });

  it("marks a model id the catalogue does not know as stale", async () => {
    renderStep((cfg) => {
      cfg.claimCheck.model = "vertex-gemini-3-flsah";
    });
    // `staleLabel` is the selector's own red "not in the catalogue" entry —
    // the admin sees the typo instead of a silent 400 under every answer.
    await waitFor(() =>
      expect(screen.getByText(de.agents.modelSelector.staleLabel.replace("{value}", "vertex-gemini-3-flsah"))).toBeDefined(),
    );
  });

  // Empty is a meaningful value (fall back to the agent's utility model, then
  // its own) and Radix Select has no empty option, so the reset button is the
  // only way back to it once a model is picked.
  it("offers a reset only while a model is chosen", () => {
    const { unmount } = renderStep();
    expect(screen.queryByText("Modellauswahl zurücksetzen")).toBeNull();
    unmount();
    renderStep((cfg) => {
      cfg.claimCheck.model = "vertex-gemini-3-flash";
    });
    expect(screen.getByText("Modellauswahl zurücksetzen")).toBeDefined();
  });
});
