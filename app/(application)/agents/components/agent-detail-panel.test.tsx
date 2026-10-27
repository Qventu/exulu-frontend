// @vitest-environment jsdom
import { MockedProvider } from "@apollo/client/testing";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import enMessages from "@/messages/en.json";

import { GET_AGENT_DETAIL, GET_AGENT_DETAIL_TOOLS } from "../queries";
import { AgentDetailPanel } from "./agent-detail-panel";

/**
 * The panel's two actions — Open in chat, Edit agent — used to sit in a
 * footer under the tools list, so a long tool list meant scrolling to reach
 * them. They belong right under the identity block.
 */

const AGENT = {
  id: "a1",
  name: "Sales Agent",
  model: "m1",
  feedback: null,
  suggestions_enabled: null,
  memory: null,
  instructions: null,
  welcomemessage: null,
  defaultagent: null,
  description: "Finds leads.",
  active: true,
  image: null,
  animation_idle: null,
  animation_responding: null,
  tools: [{ id: "t1" }, { id: "t2" }],
  skills: null,
  providerName: null,
  modelName: "gpt-5",
  maxContextLength: null,
  authenticationInformation: null,
  systemInstructions: null,
  slug: null,
  category: null,
  streaming: null,
  capabilities: { text: true, images: [], files: [], audio: [], video: [] },
  rights_mode: "private",
  RBAC: { type: null, users: [], roles: [] },
  createdAt: null,
  updatedAt: null,
};

const mocks = [
  {
    request: { query: GET_AGENT_DETAIL, variables: { id: "a1" } },
    result: { data: { agentById: AGENT } },
  },
  {
    request: { query: GET_AGENT_DETAIL_TOOLS },
    result: {
      data: {
        tools: {
          items: [
            { id: "t1", name: "Bash", type: "bash" },
            { id: "t2", name: "Hubspot read", type: "mcp" },
            { id: "t3", name: "Unused", type: "mcp" },
          ],
        },
      },
    },
  },
];

function renderPanel(
  props: Partial<React.ComponentProps<typeof AgentDetailPanel>> = {},
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MockedProvider mocks={mocks} addTypename={false}>
        <AgentDetailPanel agentId="a1" canEdit {...props} />
      </MockedProvider>
    </NextIntlClientProvider>,
  );
}

/** True when `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("AgentDetailPanel actions", () => {
  afterEach(cleanup);

  it("puts Open in chat and Edit agent above the description and the tools list", async () => {
    renderPanel();
    const chat = await screen.findByRole("link", {
      name: enMessages.agents.openInChat,
    });
    const edit = screen.getByRole("link", {
      name: enMessages.agents.editAgent,
    });
    const description = screen.getByRole("heading", {
      name: enMessages.agents.detailsSheet.description,
    });
    const tools = screen.getByRole("heading", {
      name: enMessages.agents.detailsSheet.tools,
    });
    expect(chat.getAttribute("href")).toBe("/chat/a1/new");
    expect(edit.getAttribute("href")).toBe("/agents/edit/a1");
    expect(precedes(chat, description)).toBe(true);
    expect(precedes(edit, tools)).toBe(true);
    // The agent's own name still comes first.
    expect(
      precedes(screen.getByRole("heading", { name: "Sales Agent" }), chat),
    ).toBe(true);
  });

  it("renders the actions exactly once", async () => {
    renderPanel();
    await screen.findByRole("link", { name: enMessages.agents.openInChat });
    expect(
      screen.getAllByRole("link", { name: enMessages.agents.openInChat }),
    ).toHaveLength(1);
  });

  it("hides Edit agent for read-only users", async () => {
    renderPanel({ canEdit: false });
    await screen.findByRole("link", { name: enMessages.agents.openInChat });
    expect(
      screen.queryByRole("link", { name: enMessages.agents.editAgent }),
    ).toBeNull();
  });

  it("hides both actions in the editor drill-down", async () => {
    renderPanel({ hideActions: true });
    await screen.findByRole("heading", { name: "Sales Agent" });
    expect(
      screen.queryByRole("link", { name: enMessages.agents.openInChat }),
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: enMessages.agents.editAgent }),
    ).toBeNull();
  });
});
