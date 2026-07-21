# Formatted chat copy & download — design

**Date:** 2026-07-21
**Request (end user, translated):** Using the COPY or DOWNLOAD button in chat loses most of the formatting. It should be possible to paste a chat message with its nice formatting into emails or WhatsApp messages. Manual text selection + copy works reasonably well.

## Problem

The per-message actions in `components/message-renderer.tsx`:

- **Copy** calls `navigator.clipboard.writeText(...)` with the raw markdown of *all* message parts (including chain-of-thought `reasoning` parts) joined by `\n`. Pasting into Gmail/Outlook/WhatsApp shows literal `**bold**`, `# Heading`, `|---|` tables.
- **Download** saves the same raw markdown as `message-<ts>.txt`.

Manual selection works better because the browser puts the *rendered* rich text (`text/html`) on the clipboard.

## Design

New pure module `lib/export/message-export.ts` + wiring in `message-renderer.tsx`.

### 1. Copy → multi-flavor clipboard write

One click writes a single `ClipboardItem` with two flavors:

- **`text/html`** — markdown rendered to HTML with **inline styles** (email clients drop classes/stylesheets on paste; only `style=""` attributes survive). Pipeline: `unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-stringify` (all already installed transitively via react-markdown; promoted to direct deps), followed by a small hast walker that sets a per-tag inline style map (headings, lists, blockquote, code/pre, table borders, links in brand purple). Raw HTML in the markdown is **not** passed through (`allowDangerousHtml` stays off) so we never place attacker-controlled markup on the clipboard.
- **`text/plain`** — WhatsApp-flavored text produced by an mdast walker: `*bold*`, `_italic_`, `~strike~`, `` `code` ``/``` fenced blocks, `> ` quotes, `- `/`1. ` lists, headings as bold lines, links as `text (url)`, tables as padded monospace blocks. WhatsApp renders all of these natively, and the same text reads naturally in any plain-text target (classic ASCII emphasis conventions).

Fallback: if `ClipboardItem`/`clipboard.write` is unavailable, fall back to `writeText` with the WhatsApp flavor; if the clipboard API is missing entirely, show an error toast.

Only `part.type === 'text'` parts are copied (joined with `\n\n`). This intentionally stops leaking `reasoning` (chain-of-thought) text into copies — the visible answer is what gets shared.

### 2. Download → format choice

The download icon becomes a two-item dropdown:

- **HTML (formatted)** — self-contained `message-<ts>.html` using the same inline-styled body plus a minimal document wrapper (readable width, system font stack). Opens styled in any browser, attaches to email, prints to PDF.
- **Markdown** — the previous raw text, now correctly named `message-<ts>.md` with `text/markdown`.

### Alternatives considered

- **Scrape the rendered DOM node** and copy its `outerHTML`: exact visual fidelity, but Tailwind classes are dead weight in email clients, and UI chrome (code-block copy buttons, citation chips, collapse triggers) would leak into the export. Brittle. Rejected.
- **`text/html` + raw markdown as `text/plain`:** fixes email but leaves WhatsApp (plain-text-only paste target) showing literal `**`. Rejected as half a fix.

### Out of scope

- KaTeX math renders as raw TeX in exports (as today) — email-safe math rendering is a separate effort.
- Whole-conversation export (no such button exists today; the request references the existing per-message buttons).
- Tool-call/source parts in exports.

## Review amendments (multi-agent adversarial review, same day)

A 46-agent review workflow (4 lenses × 3 refuters per finding, all executing the real code) confirmed and led to these hardening fixes:

1. **URL protocol allow-list** (critical): plain remark-rehype does not sanitize URLs the way react-markdown's `urlTransform` does, so `[x](javascript:alert(1))` reached the exported HTML executable. `styleTree` now strips `a[href]`/`img[src]` unless the protocol is http/https/mailto/tel (relative URLs kept).
2. **Reference links/images**: `[text][1]` lost its URL and `![alt][ref]` vanished in the WhatsApp flavor. A definitions pre-pass now resolves `linkReference`/`imageReference`.
3. **Raw HTML content loss**: `html` nodes were dropped wholesale; `<br>` fused words. A custom remark-rehype handler renders `<br>` as a real break and keeps other raw HTML as tag-stripped text (still never passing markup through); the WhatsApp `stripTags` maps line-structuring tags to newlines.
4. **GFM column alignment**: the hardcoded `text-align:left` on `th` beat the deprecated `align` attribute remark-rehype emits; alignment is now folded into the inline style (attribute removed).
5. **Dropdown-open visibility**: the hover-revealed actions row faded out while the portaled Download menu was open; a `has-[[data-state=open]]` variant keeps it visible.
6. **www autolinks**: `www.x.com` no longer duplicates as `www.x.com (http://www.x.com)` in the WhatsApp flavor.

Refuted (intentionally not addressed): CRLF `\r` in fenced blocks, empty-payload toasts, toast wording, raw-TeX math export (pre-existing parity with the old behavior).

## Testing

`lib/export/message-export.test.ts` (vitest, node env): WhatsApp conversion per construct (bold/italic/strike/headings/lists/nested + ordered/task lists/links/images/inline code/fenced code/blockquote/table/paragraph spacing), HTML conversion (inline styles present, no class attributes, GFM tables, raw-HTML escaping/dropping, link href preserved), document builder (charset, standalone), clipboard helper (ClipboardItem path, writeText fallback, missing-API error) with stubbed globals.
