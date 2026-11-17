// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import de from "@/messages/de.json";

import { defaultTools } from "../hooks";
import { ToolsSection } from "./tools";

// What the backend catalogue serves for the built-in picker entry.
const CATALOGUE_ENTRY = {
  id: "create_project",
  name: "Create project from chat",
  description: "Let this agent offer to turn a conversation into a project.",
  category: "default",
  type: "function",
  config: [],
};
const refs = { tools: [CATALOGUE_ENTRY], toolsLoading: false, skills: [], variables: [], contexts: [] } as any;

let saved: any[] = [];
function Harness({ initial }: { initial: any[] }) {
  const [tools, setTools] = React.useState<any[]>(initial);
  saved = tools;
  return <ToolsSection agent={{} as any} refs={refs} editor={{ tools, skills: [], setTools, setSkills: vi.fn() } as any} />;
}
const mount = (initial: any[]) =>
  render(
    <NextIntlClientProvider locale="de" messages={de}>
      <Harness initial={initial} />
    </NextIntlClientProvider>,
  );

afterEach(cleanup);

describe("create_project in the tools picker", () => {
  it("is off for an agent without the entry (nothing rendered, no default)", () => {
    mount([]);
    expect(saved).toEqual([]);
    expect(screen.queryByText(/Create project from chat/i)).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("adding it through the picker saves an entry with an array config, which survives save and reload", () => {
    mount([]);
    fireEvent.click(screen.getAllByRole("button", { name: /Werkzeuge hinzufügen/ })[0]!);
    fireEvent.click(screen.getByRole("checkbox", { name: "Create project from chat" }));
    fireEvent.click(screen.getByRole("button", { name: "1 hinzufügen" }));

    expect(saved).toEqual([{ id: "create_project", type: "function", name: "Create project from chat", config: [] }]);

    const reloaded = defaultTools({ tools: JSON.stringify(saved) } as any);
    expect(reloaded.some((t) => t.id === "create_project" && Array.isArray(t.config))).toBe(true);
  });
});
