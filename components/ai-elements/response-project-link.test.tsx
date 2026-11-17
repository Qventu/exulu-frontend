// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Response } from "./response";

afterEach(cleanup);

describe("Response", () => {
  it("keeps a relative project link as a clickable link", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const { container } = render(<Response>{`Fertig: [Projekt öffnen](/projects/${id})`}</Response>);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe(`/projects/${id}`);
  });
});
