/**
 * Tests for lib/export/message-export.ts — formatted chat message export.
 *
 * Spec: docs/superpowers/specs/2026-07-21-chat-copy-download-formatting-design.md
 * The COPY button writes a rich clipboard payload (email-safe inline-styled
 * HTML + WhatsApp-flavored plain text); DOWNLOAD offers a standalone HTML
 * document alongside raw markdown.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildMessageHtmlDocument,
  copyMessageFormatted,
  markdownToClipboardHtml,
  markdownToWhatsAppText,
} from "./message-export";

describe("markdownToWhatsAppText", () => {
  it("converts emphasis to WhatsApp markers", () => {
    expect(markdownToWhatsAppText("**bold** and *italic* and ~~gone~~")).toBe(
      "*bold* and _italic_ and ~gone~"
    );
  });

  it("keeps inline code in backticks", () => {
    expect(markdownToWhatsAppText("run `npm test` now")).toBe(
      "run `npm test` now"
    );
  });

  it("renders headings as bold lines without doubling markers", () => {
    expect(markdownToWhatsAppText("## Very **important** thing")).toBe(
      "*Very important thing*"
    );
  });

  it("separates blocks with a blank line", () => {
    expect(markdownToWhatsAppText("# Title\n\nFirst para.\n\nSecond para.")).toBe(
      "*Title*\n\nFirst para.\n\nSecond para."
    );
  });

  it("renders unordered lists with nesting", () => {
    expect(markdownToWhatsAppText("- a\n  - b\n- c")).toBe("- a\n  - b\n- c");
  });

  it("renders ordered lists with incrementing numbers and start offset", () => {
    expect(markdownToWhatsAppText("1. one\n2. two")).toBe("1. one\n2. two");
    expect(markdownToWhatsAppText("3. three\n4. four")).toBe(
      "3. three\n4. four"
    );
  });

  it("renders task lists with checkbox markers", () => {
    expect(markdownToWhatsAppText("- [x] done\n- [ ] open")).toBe(
      "- [x] done\n- [ ] open"
    );
  });

  it("renders links as text (url) and bare autolinks as the url", () => {
    expect(markdownToWhatsAppText("[Exulu](https://exulu.com)")).toBe(
      "Exulu (https://exulu.com)"
    );
    expect(markdownToWhatsAppText("see https://exulu.com")).toBe(
      "see https://exulu.com"
    );
  });

  it("renders images as their url", () => {
    expect(markdownToWhatsAppText("![diagram](https://x.com/i.png)")).toBe(
      "https://x.com/i.png"
    );
  });

  it("renders fenced code blocks without a language tag", () => {
    expect(markdownToWhatsAppText("```js\nconst a = 1;\n```")).toBe(
      "```\nconst a = 1;\n```"
    );
  });

  it("prefixes every blockquote line", () => {
    expect(markdownToWhatsAppText("> line1\n> line2")).toBe(
      "> line1\n> line2"
    );
  });

  it("renders tables as aligned monospace blocks", () => {
    const out = markdownToWhatsAppText(
      "| Name | Qty |\n| --- | --- |\n| Apple | 3 |"
    );
    expect(out.startsWith("```\n")).toBe(true);
    expect(out.endsWith("\n```")).toBe(true);
    expect(out).toContain("Name  | Qty");
    expect(out).toContain("Apple | 3");
  });

  it("strips raw html tags but keeps their text", () => {
    expect(markdownToWhatsAppText("Hello <b>world</b>")).toBe("Hello world");
  });

  it("returns empty string for empty input", () => {
    expect(markdownToWhatsAppText("")).toBe("");
  });

  it("resolves reference-style links (full, collapsed, shortcut)", () => {
    expect(
      markdownToWhatsAppText(
        "See [the docs][1] and [Exulu] too.\n\n[1]: https://docs.exulu.com\n[Exulu]: https://exulu.com"
      )
    ).toBe(
      "See the docs (https://docs.exulu.com) and Exulu (https://exulu.com) too."
    );
    expect(
      markdownToWhatsAppText("[Exulu][]\n\n[Exulu]: https://exulu.com")
    ).toBe("Exulu (https://exulu.com)");
  });

  it("resolves reference-style images to their url", () => {
    expect(
      markdownToWhatsAppText("![diagram][img]\n\n[img]: https://x.com/i.png")
    ).toBe("https://x.com/i.png");
  });

  it("does not duplicate bare www autolinks", () => {
    expect(markdownToWhatsAppText("visit www.example.com today")).toBe(
      "visit www.example.com today"
    );
  });

  it("converts <br> and raw-html block boundaries to line breaks", () => {
    expect(markdownToWhatsAppText("line one<br>line two")).toBe(
      "line one\nline two"
    );
    expect(
      markdownToWhatsAppText(
        "<table><tr><td>cell A</td><td>cell B</td></tr></table>"
      )
    ).toBe("cell A\ncell B");
  });
});

describe("markdownToClipboardHtml", () => {
  it("wraps output in a styled root and renders emphasis tags", () => {
    const html = markdownToClipboardHtml("**bold** and *italic*");
    expect(html.startsWith("<div style=")).toBe(true);
    expect(html).toContain("font-family");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("inline-styles headings", () => {
    const html = markdownToClipboardHtml("# Title");
    expect(html).toMatch(/<h1 style="[^"]*font-size[^"]*">Title<\/h1>/);
  });

  it("inline-styles table cells with borders", () => {
    const html = markdownToClipboardHtml(
      "| Name | Qty |\n| --- | --- |\n| Apple | 3 |"
    );
    expect(html).toMatch(/<th style="[^"]*border[^"]*">Name<\/th>/);
    expect(html).toMatch(/<td style="[^"]*border[^"]*">Apple<\/td>/);
  });

  it("keeps link hrefs and colors links", () => {
    const html = markdownToClipboardHtml("[Exulu](https://exulu.com)");
    expect(html).toContain('href="https://exulu.com"');
    expect(html).toMatch(/<a [^>]*style="[^"]*color[^"]*"/);
  });

  it("emits no class attributes", () => {
    const html = markdownToClipboardHtml("```js\nconst a = 1;\n```\n\n- [x] done");
    expect(html).not.toContain("class=");
  });

  it("styles inline code but not code inside pre", () => {
    const html = markdownToClipboardHtml("`inline`\n\n```\nblock\n```");
    expect(html).toMatch(/<code style="[^"]*background[^"]*">inline<\/code>/);
    expect(html).toMatch(/<pre style="[^"]*background[^"]*"><code>block/);
  });

  it("does not pass raw html through", () => {
    const html = markdownToClipboardHtml('hi <script>alert("x")</script> there');
    expect(html).not.toContain("<script>");
  });

  it("replaces task-list checkboxes with text markers", () => {
    const html = markdownToClipboardHtml("- [x] done\n- [ ] open");
    expect(html).not.toContain("<input");
    expect(html).toContain("[x] done");
    expect(html).toContain("[ ] open");
  });

  it("strips javascript: urls from links and images", () => {
    expect(markdownToClipboardHtml("[click](javascript:alert(1))")).not.toContain(
      "javascript:"
    );
    // Autolink form keeps the harmless text but must lose the href.
    expect(markdownToClipboardHtml("<javascript:alert(1)>")).not.toContain(
      "href="
    );
    expect(markdownToClipboardHtml("![x](javascript:alert(1))")).not.toContain(
      "javascript:"
    );
  });

  it("keeps http, https and mailto urls", () => {
    expect(markdownToClipboardHtml("[mail](mailto:a@b.com)")).toContain(
      'href="mailto:a@b.com"'
    );
    expect(markdownToClipboardHtml("[site](https://exulu.com)")).toContain(
      'href="https://exulu.com"'
    );
  });

  it("honors gfm column alignment on header and body cells", () => {
    const html = markdownToClipboardHtml(
      "| a | b |\n| :-: | --: |\n| 1 | 2 |"
    );
    expect(html).toMatch(/<th style="[^"]*text-align:center[^"]*">a<\/th>/);
    expect(html).toMatch(/<td style="[^"]*text-align:right[^"]*">2<\/td>/);
    expect(html).not.toContain("align=");
  });

  it("renders raw <br> as a line break and keeps raw-html text content", () => {
    expect(markdownToClipboardHtml("line one<br>line two")).toContain("<br");
    expect(
      markdownToClipboardHtml(
        "<table><tr><td>cell A</td><td>cell B</td></tr></table>"
      )
    ).toContain("cell A");
  });
});

describe("buildMessageHtmlDocument", () => {
  it("produces a standalone document containing the rendered message", () => {
    const doc = buildMessageHtmlDocument("# Hello\n\nWorld");
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain('<meta charset="utf-8"');
    expect(doc).toContain("Hello");
    expect(doc).toContain("World");
  });

  it("escapes the title", () => {
    const doc = buildMessageHtmlDocument("x", { title: '<script>"t"' });
    expect(doc).not.toContain("<script>");
    expect(doc).toContain("&lt;script&gt;");
  });
});

describe("copyMessageFormatted", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  class FakeClipboardItem {
    constructor(public items: Record<string, Blob>) {}
  }

  it("writes html + WhatsApp text flavors when ClipboardItem is available", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    vi.stubGlobal("navigator", { clipboard: { write, writeText } });

    await expect(copyMessageFormatted("**hi**")).resolves.toBe("rich");
    expect(writeText).not.toHaveBeenCalled();
    const item = write.mock.calls[0][0][0] as FakeClipboardItem;
    await expect(item.items["text/plain"].text()).resolves.toBe("*hi*");
    await expect(item.items["text/html"].text()).resolves.toContain(
      "<strong>hi</strong>"
    );
  });

  it("falls back to writeText with WhatsApp text when ClipboardItem is missing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyMessageFormatted("**hi**")).resolves.toBe("plain");
    expect(writeText).toHaveBeenCalledWith("*hi*");
  });

  it("falls back to writeText when the rich write rejects", async () => {
    const write = vi.fn().mockRejectedValue(new Error("nope"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    vi.stubGlobal("navigator", { clipboard: { write, writeText } });

    await expect(copyMessageFormatted("**hi**")).resolves.toBe("plain");
    expect(writeText).toHaveBeenCalledWith("*hi*");
  });

  it("rejects when no clipboard API exists", async () => {
    vi.stubGlobal("navigator", {});
    await expect(copyMessageFormatted("hi")).rejects.toThrow();
  });
});
