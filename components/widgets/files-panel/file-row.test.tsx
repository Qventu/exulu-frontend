// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import type { SessionFile } from "@/lib/api/session-files";

vi.mock("@/components/artifacts/share-artifact-dialog", () => ({
  ShareArtifactDialog: () => null,
}));
vi.mock("@/components/primitives/relative-time", () => ({
  RelativeTime: () => <span>{"some time ago"}</span>,
}));

import { FileRow } from "./file-row";

const file = (over: Partial<SessionFile> = {}): SessionFile => ({
  key: "sessions/s1/report.md",
  name: "report.md",
  size: 2048,
  lastModified: "2026-11-16T10:00:00.000Z",
  contentType: "text/markdown",
  presignedUrl: "https://s3/report.md",
  origin: "user",
  ...over,
});

const renderRow = (
  f: SessionFile,
  scope: React.ComponentProps<typeof FileRow>["scope"],
) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <FileRow scope={scope} file={f} onPreview={vi.fn()} onDelete={vi.fn()} />
    </NextIntlClientProvider>,
  );

const project = (canWrite: boolean) =>
  ({ kind: "project", projectId: "p1", name: "Atlas", canWrite }) as const;

describe("FileRow", () => {
  afterEach(cleanup);

  it("renders a session-scope row exactly as before (markup snapshot)", () => {
    const { container } = renderRow(file(), {
      kind: "session",
      sessionId: "s1",
    });
    expect(container).toMatchSnapshot();
  });

  it("shows the agent badge for origin agent", () => {
    renderRow(file({ origin: "agent" }), { kind: "session", sessionId: "s1" });
    const badge = screen.getByTitle("Created by the agent");
    expect(badge.getAttribute("aria-label")).toBe("Created by the agent");
  });

  it("shows no badge for origin user", () => {
    renderRow(file({ origin: "user" }), { kind: "session", sessionId: "s1" });
    expect(screen.queryByTitle("Created by the agent")).toBeNull();
  });

  it("hides delete in a read-only project scope", () => {
    renderRow(file(), project(false));
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
  });

  it("keeps delete in a writable project scope and in a session", () => {
    renderRow(file(), project(true));
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    cleanup();
    renderRow(file(), { kind: "session", sessionId: "s1" });
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });
});
