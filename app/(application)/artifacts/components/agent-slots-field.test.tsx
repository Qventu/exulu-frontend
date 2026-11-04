// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import enMessages from "@/messages/en.json";
import type { Agent } from "@/types/models/agent";

// jsdom does not implement scrollIntoView; Radix Select's content
// positioning calls it on mount when open.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * Apollo is mocked at the hook — GET_AGENTS selects the whole AGENT_FIELDS
 * shape, which is not what this test is about (agent-grid.test.tsx pattern).
 */
const grid = vi.hoisted(() => ({
  agents: [] as Agent[],
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: () => ({
      data: { agentsPagination: { items: grid.agents } },
      loading: false,
    }),
  };
});

import { AgentSlotsField, type AgentSlotsFieldProps } from "./agent-slots-field";

// vitest.config.ts does not set test.globals, so testing-library's implicit
// afterEach(cleanup) never registers — unmount explicitly.
afterEach(cleanup);

const agent = (id: string, name: string): Agent => ({
  id,
  name,
  type: "agent",
  active: true,
});

function renderField(props: Partial<AgentSlotsFieldProps> & { onChange: AgentSlotsFieldProps["onChange"] }) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <AgentSlotsField value={[]} isApp={true} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("AgentSlotsField", () => {
  test("renders nothing for a non-app artifact", () => {
    const { container } = render(<AgentSlotsField value={[]} onChange={() => {}} isApp={false} />);
    expect(container.textContent).toBe("");
  });

  test("adding a slot reports a key and the chosen agent", async () => {
    grid.agents = [agent("a1", "Agent One"), agent("a2", "Agent Two")];
    const onChange = vi.fn();
    renderField({ value: [], onChange });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "analyse" } });
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Agent One" }));
    fireEvent.click(screen.getByRole("button", { name: enMessages.artifacts.agentSlotAdd }));

    expect(onChange).toHaveBeenCalledWith([{ key: "analyse", agentId: "a1" }]);
  });

  test("a duplicate key is rejected in the UI before save", () => {
    grid.agents = [agent("a1", "Agent One")];
    const onChange = vi.fn();
    renderField({ value: [{ key: "analyse", agentId: "a1" }], onChange });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "analyse" } });

    const addButton = screen.getByRole("button", { name: enMessages.artifacts.agentSlotAdd }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
    expect(screen.getByText(enMessages.artifacts.agentSlotDuplicateKey)).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("removing a slot reports the remaining list", () => {
    grid.agents = [agent("a1", "Agent One"), agent("a2", "Agent Two")];
    const onChange = vi.fn();
    renderField({
      value: [
        { key: "a", agentId: "a1" },
        { key: "b", agentId: "a2" },
      ],
      onChange,
    });

    const row = screen.getByText("a").closest("div") as HTMLElement;
    fireEvent.click(within(row).getByRole("button"));

    expect(onChange).toHaveBeenCalledWith([{ key: "b", agentId: "a2" }]);
  });
});
