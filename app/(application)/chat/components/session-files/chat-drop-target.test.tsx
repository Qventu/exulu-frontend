// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";

const upload = vi.hoisted(() => ({
  uploadSessionFiles: vi.fn(async () => ({
    uploaded: 1,
    failed: 0,
    rejected: false,
  })),
}));
vi.mock("./upload", () => ({ uploadSessionFiles: upload.uploadSessionFiles }));

import { ChatDropTarget } from "./chat-drop-target";

/**
 * Dragging a file over the conversation is trained behaviour ("if I drop it
 * in the chat, the agent sees it"). With the sandbox on, the overlay names the
 * destination, the files panel opens to show it, and the drop uploads there.
 */

const makeController = (overrides: Record<string, unknown> = {}) => ({
  agent: { id: "a1", name: "Agent", sandbox_enabled: true },
  writeAccess: true,
  filesPanelOpen: false,
  setFilesPanelOpen: vi.fn(async () => {}),
  ensureSession: vi.fn(async () => ({ id: "s1" })),
  ...overrides,
});

function renderTarget(controller: ReturnType<typeof makeController>) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ChatDropTarget controller={controller as never}>
        <div data-testid="conversation">conversation</div>
      </ChatDropTarget>
    </NextIntlClientProvider>,
  );
}

const fileDrag = (files: File[] = []) => ({
  dataTransfer: { types: ["Files"], files, items: [] },
});

describe("ChatDropTarget", () => {
  beforeEach(() => upload.uploadSessionFiles.mockClear());
  afterEach(cleanup);

  it("shows the drop overlay for a file drag and opens the files panel", () => {
    const controller = makeController();
    renderTarget(controller);
    fireEvent.dragEnter(screen.getByTestId("conversation"), fileDrag());
    expect(screen.getByText(enMessages.chat.files.dropTitle)).toBeDefined();
    expect(controller.setFilesPanelOpen).toHaveBeenCalledWith(true);
  });

  it("says the sandbox is off instead of opening the panel", () => {
    const controller = makeController({
      agent: { id: "a1", name: "Agent", sandbox_enabled: false },
    });
    renderTarget(controller);
    fireEvent.dragEnter(screen.getByTestId("conversation"), fileDrag());
    expect(
      screen.getByText(enMessages.chat.attach.sessionFilesDisabled),
    ).toBeDefined();
    expect(controller.setFilesPanelOpen).not.toHaveBeenCalled();
  });

  it("ignores drags that carry no files", () => {
    const controller = makeController();
    renderTarget(controller);
    fireEvent.dragEnter(screen.getByTestId("conversation"), {
      dataTransfer: { types: ["text/plain"], files: [], items: [] },
    });
    expect(screen.queryByText(enMessages.chat.files.dropTitle)).toBeNull();
    expect(controller.setFilesPanelOpen).not.toHaveBeenCalled();
  });

  it("hides the overlay again when the drag leaves", () => {
    const controller = makeController();
    renderTarget(controller);
    const target = screen.getByTestId("conversation");
    fireEvent.dragEnter(target, fileDrag());
    fireEvent.dragLeave(target, fileDrag());
    expect(screen.queryByText(enMessages.chat.files.dropTitle)).toBeNull();
  });

  it("uploads dropped files into the session and clears the overlay", async () => {
    const controller = makeController();
    renderTarget(controller);
    const target = screen.getByTestId("conversation");
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.dragEnter(target, fileDrag([file]));
    await act(async () => {
      fireEvent.drop(target, fileDrag([file]));
    });
    expect(controller.ensureSession).toHaveBeenCalled();
    expect(upload.uploadSessionFiles).toHaveBeenCalledTimes(1);
    const [sessionId, files] = upload.uploadSessionFiles.mock
      .calls[0] as unknown as [string, File[]];
    expect(sessionId).toBe("s1");
    expect(files.map((f) => f.name)).toEqual(["notes.txt"]);
    expect(screen.queryByText(enMessages.chat.files.dropTitle)).toBeNull();
  });

  it("does not upload when the user has no write access", async () => {
    const controller = makeController({ writeAccess: false });
    renderTarget(controller);
    const target = screen.getByTestId("conversation");
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.dragEnter(target, fileDrag([file]));
    await act(async () => {
      fireEvent.drop(target, fileDrag([file]));
    });
    expect(upload.uploadSessionFiles).not.toHaveBeenCalled();
  });
});
