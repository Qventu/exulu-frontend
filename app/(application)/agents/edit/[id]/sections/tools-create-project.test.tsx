// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import de from "@/messages/de.json";

import { ToolsSection } from "./tools";

const refs = { tools: [], toolsLoading: false, skills: [], variables: [], contexts: [] } as any;

const setup = (tools: any[]) => {
  const setTools = vi.fn();
  render(
    <NextIntlClientProvider locale="de" messages={de}>
      <ToolsSection agent={{} as any} refs={refs} editor={{ tools, skills: [], setTools, setSkills: vi.fn() } as any} />
    </NextIntlClientProvider>,
  );
  return setTools;
};

afterEach(cleanup);

describe("Projekte anlegen switch", () => {
  it("is off by default and stores the opt-in entry when switched on", () => {
    const setTools = setup([]);
    const sw = screen.getByRole("switch", { name: "Projekte anlegen" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/nach Freigabe aus einer Unterhaltung ein Projekt anlegen/)).toBeTruthy();
    fireEvent.click(sw);
    expect(setTools).toHaveBeenCalledWith([expect.objectContaining({ id: "create_project", type: "function", config: [] })]);
  });

  it("is on when the entry exists and removes it when switched off", () => {
    const entry = { id: "create_project", type: "function", name: "create_project", config: [] };
    const setTools = setup([entry]);
    const sw = screen.getByRole("switch", { name: "Projekte anlegen" });
    expect(sw.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(sw);
    expect(setTools).toHaveBeenCalledWith([]);
  });
});
