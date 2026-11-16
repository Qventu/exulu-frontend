// @vitest-environment jsdom
/**
 * "@" in a project session lists the project's shared files in their own
 * group, labelled with the project name, and inserts `project/<name>` — the
 * form the agent's prompt and tools understand. Session files keep inserting
 * their bare name.
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const api = vi.hoisted(() => ({ sessionList: vi.fn(), projectList: vi.fn() }));
vi.mock("@/lib/api/session-files", () => ({
  sessionFilesApi: { list: api.sessionList },
}));
vi.mock("@/lib/api/project-files", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/project-files")>()),
  projectFilesApi: { list: api.projectList },
}));
vi.mock("@apollo/client", async (orig) => ({
  ...(await orig<typeof import("@apollo/client")>()),
  useLazyQuery: () => [vi.fn().mockResolvedValue({}), { data: undefined }],
}));

import type { ChatSessionController } from "../../hooks";
import { useComposerAutocomplete } from "./use-composer-autocomplete";

const f = (name: string, key: string) => ({
  key,
  name,
  size: 1,
  lastModified: "2026-11-16T10:00:00.000Z",
  contentType: "text/plain",
  presignedUrl: "u",
});
const SESSION_FILE = f("notes.md", "user_1/s1/notes.md");
const PROJECT_FILE = f("brief.pdf", "projects/p1/brief.pdf");

const controller = (projectFiles: ChatSessionController["projectFiles"]) =>
  ({
    agent: { id: "a1", name: "A", tools: [], skills: [], sandbox_enabled: true },
    maxInputLength: 10_000,
    session: { id: "s1" },
    disabledTools: [],
    projectFiles,
  }) as unknown as ChatSessionController;

function setup(projectFiles: ChatSessionController["projectFiles"]) {
  const textarea = document.createElement("textarea");
  textarea.value = "@";
  textarea.setSelectionRange(1, 1);
  const inputRef = { current: textarea };
  const setInput = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
  const hook = renderHook(
    () =>
      useComposerAutocomplete({
        controller: controller(projectFiles),
        input: "@",
        setInput,
        inputRef,
        onExecuteCommand: vi.fn(),
      }),
    { wrapper },
  );
  act(() => hook.result.current.onSelect({} as never));
  return { ...hook, setInput };
}

beforeEach(() => {
  api.sessionList.mockReset().mockResolvedValue({ files: [SESSION_FILE] });
  api.projectList
    .mockReset()
    .mockResolvedValue({ canWrite: true, files: [PROJECT_FILE] });
});
afterEach(cleanup);

describe("useComposerAutocomplete '@' with a project", () => {
  it("lists project files in their own group labelled with the project name", async () => {
    const { result } = setup({
      id: "p1",
      name: "Atlas",
      canWrite: true,
      files: [PROJECT_FILE],
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    const [session, project] = result.current.items;
    expect(session).toMatchObject({ name: "notes.md", kind: "file" });
    expect(session.group).toBeUndefined();
    expect(project).toMatchObject({
      name: "project/brief.pdf",
      displayName: "brief.pdf",
      kind: "file",
      group: "Project · Atlas",
    });
  });

  it("inserts project/<name> for a project file", async () => {
    const { result, setInput } = setup({
      id: "p1",
      name: "Atlas",
      canWrite: true,
      files: [PROJECT_FILE],
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => result.current.applySuggestion(result.current.items[1]));
    expect(setInput).toHaveBeenCalledWith("@project/brief.pdf ");
  });

  it("without a project lists only session files and never asks the project route", async () => {
    const { result } = setup(null);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].name).toBe("notes.md");
    expect(api.projectList).not.toHaveBeenCalled();
  });
});
