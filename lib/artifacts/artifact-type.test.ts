import { describe, expect, it } from "vitest";

import { artifactType, displayFilename, extensionOf } from "./artifact-type";

describe("artifactType", () => {
  it("reads the kind from the extension first", () => {
    expect(artifactType("tender-cockpit/index.html").kind).toBe("app");
    expect(artifactType("report.PDF").kind).toBe("pdf");
    expect(artifactType("deck.pptx").kind).toBe("slides");
    expect(artifactType("numbers.xlsx").kind).toBe("sheet");
    expect(artifactType("notes.docx").kind).toBe("document");
    expect(artifactType("chart.png").kind).toBe("image");
    expect(artifactType("readme.md").kind).toBe("text");
    expect(artifactType("export.json").kind).toBe("data");
  });

  it("falls back to the content type, then to file", () => {
    expect(artifactType("download", "application/pdf").kind).toBe("pdf");
    expect(artifactType("download", "application/vnd.openxmlformats-officedocument.presentationml.presentation").kind).toBe("slides");
    expect(artifactType("download", "text/csv").kind).toBe("sheet");
    expect(artifactType("download", null).kind).toBe("file");
    expect(artifactType("archive.zip", "application/zip").kind).toBe("file");
  });

  it("names the badge key and whether the viewer shows it inline", () => {
    expect(artifactType("a.html")).toEqual({ kind: "app", labelKey: "typeApp", inline: true });
    expect(artifactType("a.pdf").inline).toBe(true);
    expect(artifactType("a.png").inline).toBe(true);
    expect(artifactType("a.pptx").inline).toBe(false);
    expect(artifactType("a.xlsx").labelKey).toBe("typeSheet");
  });

  it("extracts extensions and display names", () => {
    expect(extensionOf("x/y/z.tar.gz")).toBe("gz");
    expect(extensionOf("noext")).toBe("");
    expect(extensionOf(".hidden")).toBe("");
    expect(displayFilename("users/42/1234-_EXULU_report.pdf")).toBe("report.pdf");
    expect(displayFilename("shared-artifacts/tender-cockpit/index.html")).toBe("index.html");
  });
});
