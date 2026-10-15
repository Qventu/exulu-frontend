import { describe, expect, it } from "vitest";

import { GET_AGENT_EDITOR } from "@/app/(application)/agents/edit/[id]/queries";
import { GET_USER_ROLES } from "@/app/(application)/users/queries";

import { DEMO_AGENT_ID } from "./fixtures";
import { ROLE_TECHNIKER_ID } from "./fixtures/roles";
import { runDemoOperation as run, runDemoQueryThroughCache } from "./test-support";
import { CHAPTERS } from "./tour";

const AT = { chapter: "zugriff", step: 0 } as const;

describe("chapter 4 opens on the assistant's access section", () => {
  it("shares the assistant with one role, which the roster lists by name", async () => {
    const editor = await run(GET_AGENT_EDITOR, { id: DEMO_AGENT_ID }, AT);
    const agent = editor.agentById as {
      rights_mode: string;
      RBAC: { roles: { id: string; rights: string }[] };
    };
    expect(agent.rights_mode).toBe("roles");
    expect(agent.RBAC.roles).toEqual([{ id: ROLE_TECHNIKER_ID, rights: "read" }]);

    // Through the cache: the roster must carry every field the document selects.
    const roster = await runDemoQueryThroughCache(GET_USER_ROLES, { page: 1, limit: 100 }, AT);
    const items = (roster.rolesPagination as { items: { id: string; name: string }[] }).items;
    expect(items.find((r) => r.id === ROLE_TECHNIKER_ID)?.name).toBe("Techniker");
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("anchors the first zugriff step on the editor's access section", () => {
    const step = CHAPTERS.find((c) => c.id === "zugriff")!.steps[0];
    expect(step.id).toBe("zugriff-agent");
    expect(step.route).toBe(`/agents/edit/${DEMO_AGENT_ID}`);
    expect(step.anchor).toBe("agent-access");
    expect(step.scrollBlock).toBe("start");
  });
});
