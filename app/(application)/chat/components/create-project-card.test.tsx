// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { OpenProjectLink } from "./create-project-card";
import { ToolCallApproval } from "./tool-call-approval";

const ID = "123e4567-e89b-12d3-a456-426614174000";

const part = (files: string[], name = "Messe 2027") =>
  ({
    type: "tool-create_project",
    toolCallId: "tc1",
    state: "approval-requested",
    input: { name, files },
    approval: { id: "ap1" },
  }) as any;

const renderApproval = (p: any, locale: "de" | "en" = "de", add = vi.fn(), forChat = vi.fn()) =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "de" ? de : en}>
      <ToolCallApproval part={p} addToolApprovalResponse={add} onApproveForChat={forChat} />
    </NextIntlClientProvider>,
  );

afterEach(cleanup);

describe("create_project approval card", () => {
  it("names the project and lists the files that will be moved (de)", () => {
    renderApproval(part(["angebot.pdf", "skizze.png"]));
    expect(screen.getByText(/Projekt „Messe 2027“ anlegen und 2 Dateien dorthin verschieben/)).toBeTruthy();
    expect(screen.getByText("angebot.pdf")).toBeTruthy();
    expect(screen.getByText("skizze.png")).toBeTruthy();
    expect(screen.getByText("Das Projekt ist zunächst nur für Sie sichtbar.")).toBeTruthy();
  });

  it("uses singular and zero wording", () => {
    renderApproval(part(["a.pdf"]));
    expect(screen.getByText(/und 1 Datei dorthin verschieben/)).toBeTruthy();
    cleanup();
    renderApproval(part([]));
    expect(screen.getByText(/anlegen ohne Dateien zu verschieben/)).toBeTruthy();
    expect(screen.getByText("Keine Dateien")).toBeTruthy();
  });

  it("speaks English", () => {
    renderApproval(part([]), "en");
    expect(screen.getByText("No files")).toBeTruthy();
    expect(screen.getByText("The project is only visible to you at first.")).toBeTruthy();
  });

  it("never offers 'allow for this chat' (the tool always asks) but approves once and denies", () => {
    const add = vi.fn();
    renderApproval(part(["a.pdf"]), "de", add);
    expect(screen.queryByText("Für diesen Chat erlauben")).toBeNull();
    fireEvent.click(screen.getByText("Einmal erlauben"));
    expect(add).toHaveBeenCalledWith({ id: "ap1", approved: true });
    fireEvent.click(screen.getByText("Ablehnen"));
    expect(add).toHaveBeenCalledWith({ id: "ap1", approved: false });
  });

  it("keeps the generic card for other tools", () => {
    renderApproval({ ...part([]), type: "tool-bash", input: { command: "ls" } });
    expect(screen.getByText("Für diesen Chat erlauben")).toBeTruthy();
  });
});

describe("long file lists", () => {
  it("lists every file inside a bounded scroll box that wraps long names", () => {
    const names = Array.from({ length: 60 }, (_, i) => `datei-${i}.pdf`);
    renderApproval(part(names, "x".repeat(200)));
    expect(screen.getByText("datei-59.pdf")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(60);
    expect(screen.queryByText(/weitere/)).toBeNull();
    const list = screen.getByRole("list");
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toContain("max-h-48");
    expect(screen.getByText("datei-0.pdf").className).toContain("[overflow-wrap:anywhere]");
    expect(screen.getByText(/x{200}/).className).toContain("[overflow-wrap:anywhere]");
    expect(screen.getByText("Einmal erlauben")).toBeTruthy();
  });

  it("keys duplicate names without collision", () => {
    renderApproval(part(["a.pdf", "a.pdf"]));
    expect(screen.getAllByText("a.pdf")).toHaveLength(2);
  });
});

describe("OpenProjectLink", () => {
  it("links to the project found in the result", () => {
    render(
      <NextIntlClientProvider locale="de" messages={de}>
        <OpenProjectLink output={{ result: `Projekt angelegt: /projects/${ID}` }} name="Pitch Alpha" sessionProjectId={ID} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Pitch Alpha")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Projekt öffnen" }).getAttribute("href")).toBe(`/projects/${ID}`);
    expect(screen.getByRole("link", { name: "Projekt öffnen" }).getAttribute("target")).toBe("_blank");
  });

  it("renders nothing when the session has no such project, even if the text names a path", () => {
    const output = { result: `Fehlgeschlagen, siehe /projects/${ID}` };
    for (const sessionProjectId of [undefined, "", "other-project"]) {
      const { container } = render(
        <NextIntlClientProvider locale="de" messages={de}>
          <OpenProjectLink output={output} sessionProjectId={sessionProjectId} />
        </NextIntlClientProvider>,
      );
      expect(container.textContent).toBe("");
      cleanup();
    }
  });

  it("renders nothing without a link", () => {
    const { container } = render(
      <NextIntlClientProvider locale="de" messages={de}>
        <OpenProjectLink output={{ result: "fehlgeschlagen" }} />
      </NextIntlClientProvider>,
    );
    expect(container.textContent).toBe("");
  });
});
