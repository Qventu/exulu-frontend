// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/api/project-files", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/project-files")>()),
  projectFilesApi: { list: api.list },
}));
vi.mock("@/lib/api/session-files", () => ({ sessionFilesApi: {} }));

import { FilesPanelContent } from "./panel-content";

const ui = (canWrite: boolean) => (
  <NextIntlClientProvider locale="en" messages={enMessages}>
    <FilesPanelContent
      scope={{ kind: "project", projectId: "p1", name: "Atlas", canWrite }}
    />
  </NextIntlClientProvider>
);

describe("FilesPanelContent scope identity", () => {
  afterEach(cleanup);

  it("does not refetch when re-rendered with an equal but new scope object", async () => {
    api.list.mockReset().mockResolvedValue({ canWrite: true, files: [] });
    const { rerender } = render(ui(true));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
    rerender(ui(true));
    rerender(ui(true));
    await new Promise((r) => setTimeout(r, 20));
    expect(api.list).toHaveBeenCalledTimes(1);
  });
});
