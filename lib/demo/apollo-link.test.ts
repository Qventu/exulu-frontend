import { ApolloLink, execute, gql, Observable } from "@apollo/client/core";
import { describe, expect, it } from "vitest";
import { createDemoLink } from "./apollo-link";
import type { DemoWorld } from "./types";

const WORLD = {
  agents: [{ id: "a1", name: "Demo agent" }],
  contexts: [{ id: "c1", name: "Docs" }],
  items: [],
  sessions: [],
} as unknown as DemoWorld;

function run(link: ApolloLink, query: ReturnType<typeof gql>): Promise<any> {
  return new Promise((resolve, reject) => {
    const obs = execute(link, { query }) as Observable<any>;
    obs.subscribe({ next: resolve, error: reject });
  });
}

describe("createDemoLink", () => {
  it("resolves a known operation from the world", async () => {
    const link = createDemoLink(() => WORLD);
    const result = await run(link, gql`query agents { agents { id name } }`);
    expect(result.data.agents).toHaveLength(1);
    expect(result.data.agents[0].id).toBe("a1");
  });

  it("reads the world lazily, so stepping the tour changes results", async () => {
    let world = WORLD;
    const link = createDemoLink(() => world);
    world = { ...WORLD, agents: [] } as unknown as DemoWorld;
    const result = await run(link, gql`query agents { agents { id } }`);
    expect(result.data.agents).toHaveLength(0);
  });

  it("returns empty data for an unmapped operation rather than throwing", async () => {
    const link = createDemoLink(() => WORLD);
    const result = await run(link, gql`query somethingUnmapped { widgets { id } }`);
    expect(result.data).toEqual({});
  });

  it("names the operation it could not map, to make gaps findable", async () => {
    const seen: string[] = [];
    const link = createDemoLink(() => WORLD, (name) => seen.push(name));
    await run(link, gql`query somethingUnmapped { widgets { id } }`);
    expect(seen).toEqual(["somethingUnmapped"]);
  });
});
