import { parse, type FieldNode, type OperationDefinitionNode } from "graphql";
import { describe, expect, it } from "vitest";

import { GET_AGENT_BY_ID } from "./queries";
import { GET_AGENTS_BY_IDS } from "@/queries/queries";

/**
 * The artifact page hands the agent it loads with GET_AGENTS_BY_IDS straight
 * to the chat's SessionScreen. Every agent field the chat route itself selects
 * must therefore be in that document too — a field the chat reads but the
 * artifact page never fetched is `undefined`, and the composer treats
 * `undefined` as "off" (the attach menu greyed out "Session files" with
 * "the file sandbox is off for this agent" on an agent whose sandbox was on).
 */
const agentFieldNames = (body: string): Set<string> => {
  const op = parse(body).definitions.find(
    (d): d is OperationDefinitionNode => d.kind === "OperationDefinition",
  );
  const root = op?.selectionSet.selections[0] as FieldNode | undefined;
  const names = new Set<string>();
  for (const sel of root?.selectionSet?.selections ?? []) {
    if (sel.kind === "Field") names.add(sel.name.value);
  }
  return names;
};

describe("artifact panel agent query", () => {
  it("selects every agent field the chat route selects", () => {
    const chat = agentFieldNames(GET_AGENT_BY_ID.loc!.source.body);
    const panel = agentFieldNames(GET_AGENTS_BY_IDS.loc!.source.body);
    const missing = [...chat].filter((name) => !panel.has(name));
    expect(missing).toEqual([]);
    // Guard against the helper silently comparing two empty sets.
    expect(chat.has("sandbox_enabled")).toBe(true);
  });
});
