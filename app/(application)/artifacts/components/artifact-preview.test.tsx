// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { artifactType } from "@/lib/artifacts/artifact-type";
import enMessages from "@/messages/en.json";

import type { ArtifactListItem } from "../hooks";
import { ArtifactPreview } from "./artifact-preview";

/**
 * The thumbnail on a favourite card: an HTML app renders scaled down in a
 * script-only sandbox (no popups, no forms, no identity), an image loads
 * straight from the content route, everything else shows its kind.
 */

const fetchMock = vi.fn();

const make = (
  filename: string,
  contentType: string,
  overrides: Partial<ArtifactListItem> = {},
): ArtifactListItem => ({
  id: "1",
  name: "report",
  filename,
  type: artifactType(filename, contentType),
  authMode: "regular",
  expiresAt: null,
  expired: false,
  mine: true,
  canManage: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  href: "/artifacts/open/report",
  shareUrl: "/artifacts/report",
  ...overrides,
});

function renderPreview(item: ArtifactListItem) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ArtifactPreview item={item} />
    </NextIntlClientProvider>,
  );
}

describe("ArtifactPreview", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders an HTML app scaled down in a script-only sandbox, fetched through the content route", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "<html><body>hi</body></html>",
    });
    const { container } = renderPreview(make("report.html", "text/html"));
    await waitFor(() =>
      expect(container.querySelector("iframe")).not.toBeNull(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/artifacts/report/content",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    const frame = container.querySelector("iframe") as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("srcdoc")).toContain("hi");
    expect(frame.getAttribute("tabindex")).toBe("-1");
    expect(frame.getAttribute("aria-hidden")).toBe("true");
  });

  it("falls back to the kind icon when the app cannot be fetched", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const { container } = renderPreview(make("report.html", "text/html"));
    await waitFor(() =>
      expect(screen.getByText(enMessages.artifacts.typeApp)).toBeDefined(),
    );
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("shows an image straight from the content route", () => {
    const { container } = renderPreview(make("chart.png", "image/png"));
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/artifacts/report/content");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a PDF as its kind, without loading anything", () => {
    const { container } = renderPreview(make("deck.pdf", "application/pdf"));
    expect(screen.getByText(enMessages.artifacts.typePdf)).toBeDefined();
    expect(container.querySelector("iframe")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never loads an expired artifact", () => {
    const { container } = renderPreview(
      make("report.html", "text/html", { expired: true }),
    );
    expect(screen.getByText(enMessages.artifacts.expired)).toBeDefined();
    expect(container.querySelector("iframe")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
