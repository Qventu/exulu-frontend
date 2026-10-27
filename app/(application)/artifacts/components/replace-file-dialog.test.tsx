// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { artifactType } from "@/lib/artifacts/artifact-type";
import enMessages from "@/messages/en.json";

import type { ArtifactListItem } from "../hooks";

/**
 * "Replace file": a new upload behind an existing share link. The link, its
 * name and its sharing settings stay; only the object behind it changes —
 * sign → PUT → PATCH { s3key } (the backend already supported the PATCH, the
 * list just never offered it).
 */

const api = vi.hoisted(() => ({
  signUpload: vi.fn(),
  putToSignedUrl: vi.fn(),
  update: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/api/shared-artifacts", () => ({ sharedArtifactsApi: api }));
vi.mock("sonner", () => ({ toast: toasts }));

import { ReplaceFileDialog } from "./replace-file-dialog";

const t = enMessages.artifacts;

const ITEM: ArtifactListItem = {
  id: "1",
  name: "q3-report",
  filename: "q3-report.html",
  type: artifactType("q3-report.html", "text/html"),
  authMode: "regular",
  expiresAt: null,
  expired: false,
  mine: true,
  canManage: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  href: "/artifacts/open/q3-report",
  shareUrl: "/artifacts/q3-report",
};

function renderDialog(item: ArtifactListItem | null = ITEM) {
  const onOpenChange = vi.fn();
  const onReplaced = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ReplaceFileDialog
        item={item}
        onOpenChange={onOpenChange}
        onReplaced={onReplaced}
      />
    </NextIntlClientProvider>,
  );
  return { onOpenChange, onReplaced };
}

const pick = (file: File) => {
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
};

const label = (key: keyof typeof t) => t[key] as string;

describe("ReplaceFileDialog", () => {
  beforeEach(() => {
    api.signUpload.mockReset().mockResolvedValue({
      key: "abc-_EXULU_q3-report-v2.html",
      url: "https://files.example.test/bucket/user_1/abc-_EXULU_q3-report-v2.html",
      method: "PUT",
    });
    api.putToSignedUrl.mockReset().mockResolvedValue(undefined);
    api.update
      .mockReset()
      .mockResolvedValue({
        name: "q3-report",
        auth_mode: "regular",
        expires_at: null,
        rights_mode: null,
      });
    toasts.success.mockReset();
    toasts.error.mockReset();
  });
  afterEach(cleanup);

  it("names the share it replaces and keeps Replace disabled until a file is chosen", () => {
    renderDialog();
    expect(
      screen.getByText(label("replaceTitle").replace("{name}", "q3-report")),
    ).toBeDefined();
    const button = screen.getByRole("button", {
      name: label("replaceSave"),
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("uploads the new file and re-points the share at it, link unchanged", async () => {
    const { onReplaced, onOpenChange } = renderDialog();
    pick(new File(["<html/>"], "q3-report-v2.html", { type: "text/html" }));
    fireEvent.click(screen.getByRole("button", { name: label("replaceSave") }));
    await waitFor(() => expect(onReplaced).toHaveBeenCalledWith("q3-report"));
    expect(api.signUpload).toHaveBeenCalledWith(
      "q3-report-v2.html",
      "text/html",
    );
    expect(api.putToSignedUrl).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledWith("q3-report", {
      s3key: "bucket/user_1/abc-_EXULU_q3-report-v2.html",
      content_type: "text/html",
    });
    expect(toasts.success).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog open and never patches the share when the upload fails", async () => {
    api.putToSignedUrl.mockRejectedValueOnce(
      new Error("S3 upload failed: 403"),
    );
    const { onReplaced } = renderDialog();
    pick(new File(["<html/>"], "q3-report-v2.html", { type: "text/html" }));
    fireEvent.click(screen.getByRole("button", { name: label("replaceSave") }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledTimes(1));
    expect(api.update).not.toHaveBeenCalled();
    expect(onReplaced).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: label("replaceSave") }),
    ).toBeDefined();
  });

  it("warns when the new file opens as a different kind of artifact", () => {
    renderDialog();
    pick(new File(["%PDF-1.4"], "q3-report.pdf", { type: "application/pdf" }));
    const current = t[ITEM.type.labelKey as keyof typeof t] as string;
    const next = t[
      artifactType("q3-report.pdf", "application/pdf")
        .labelKey as keyof typeof t
    ] as string;
    expect(
      screen.getByText(
        label("replaceTypeChange")
          .replace("{next}", next)
          .replace("{current}", current),
      ),
    ).toBeDefined();
  });

  it("says nothing about the kind when it stays the same", () => {
    renderDialog();
    pick(new File(["<html/>"], "other.html", { type: "text/html" }));
    expect(screen.queryByText(/instead of/)).toBeNull();
  });
});
