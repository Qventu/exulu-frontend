/**
 * Formatted export of chat messages (spec:
 * docs/superpowers/specs/2026-07-21-chat-copy-download-formatting-design.md).
 *
 * Email clients keep only inline `style` attributes when pasting HTML, and
 * WhatsApp only accepts plain text (with its own `*bold*`/`_italic_` syntax),
 * so the clipboard payload carries both flavors and the download variant is a
 * self-contained inline-styled document.
 */
import type { Element, ElementContent, Root as HastRoot } from "hast";
import type {
  Html,
  List,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
  Table,
} from "mdast";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

// --------------------------------------------------------------------------
// Markdown → WhatsApp-flavored plain text
// --------------------------------------------------------------------------

type Definitions = Map<string, { url: string }>;

type InlineCtx = {
  /** Drop all formatting markers (used inside monospace table blocks). */
  plain?: boolean;
  /** Drop `*` markers only — the whole line is already bold (headings). */
  suppressStrong?: boolean;
  /** Reference-link definitions ([id]: url) collected from the whole tree. */
  defs?: Definitions;
};

// Line-structuring tags become breaks so stripped raw HTML doesn't fuse words.
const stripTags = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|blockquote|pre|table|ul|ol)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "");

function collectDefinitions(node: Root | RootContent, defs: Definitions): void {
  if (node.type === "definition") {
    defs.set(node.identifier.toLowerCase(), { url: node.url });
    return;
  }
  if ("children" in node) {
    for (const child of node.children) {
      collectDefinitions(child as RootContent, defs);
    }
  }
}

function renderLinkText(text: string, rawUrl: string): string {
  const url = rawUrl.replace(/^mailto:/, "");
  // GFM www-autolinks prefix "http://", so text === url misses them.
  const bare =
    text === url || `http://${text}` === url || `https://${text}` === url;
  if (bare) return text || url;
  return text ? `${text} (${url})` : url;
}

function renderInline(
  nodes: PhrasingContent[] | undefined,
  ctx: InlineCtx
): string {
  return (nodes ?? []).map((node) => renderInlineNode(node, ctx)).join("");
}

function renderInlineNode(node: PhrasingContent, ctx: InlineCtx): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "strong": {
      const inner = renderInline(node.children, ctx);
      return ctx.plain || ctx.suppressStrong ? inner : `*${inner}*`;
    }
    case "emphasis": {
      const inner = renderInline(node.children, ctx);
      return ctx.plain ? inner : `_${inner}_`;
    }
    case "delete": {
      const inner = renderInline(node.children, ctx);
      return ctx.plain ? inner : `~${inner}~`;
    }
    case "inlineCode":
      return ctx.plain ? node.value : `\`${node.value}\``;
    case "link":
      return renderLinkText(renderInline(node.children, ctx), node.url);
    case "linkReference": {
      const def = ctx.defs?.get(node.identifier.toLowerCase());
      const text = renderInline(node.children, ctx);
      if (!def) return text || `[${node.identifier}]`;
      return renderLinkText(text, def.url);
    }
    case "image":
      return node.url;
    case "imageReference":
      return ctx.defs?.get(node.identifier.toLowerCase())?.url ?? node.alt ?? "";
    case "break":
      return "\n";
    case "html":
      return stripTags(node.value);
    case "footnoteReference":
      return `[${node.identifier}]`;
    default:
      return "children" in node
        ? renderInline(node.children as PhrasingContent[], ctx)
        : "";
  }
}

const indentLines = (text: string, indent: string) =>
  text
    .split("\n")
    .map((line) => (line.length > 0 ? indent + line : line))
    .join("\n");

function renderList(list: List, indent: string, defs: Definitions): string {
  const childIndent = indent + "  ";
  return list.children
    .map((item: ListItem, index: number) => {
      const marker = list.ordered ? `${(list.start ?? 1) + index}. ` : "- ";
      const check =
        typeof item.checked === "boolean"
          ? item.checked
            ? "[x] "
            : "[ ] "
          : "";
      const blocks = item.children
        .map((child) =>
          child.type === "list"
            ? renderList(child, childIndent, defs)
            : indentLines(renderBlockNode(child, childIndent, defs), childIndent)
        )
        .filter((part) => part.length > 0);
      const [first = "", ...rest] = blocks;
      const firstLines = first.split("\n");
      const head = `${indent}${marker}${check}${firstLines[0]?.trimStart() ?? ""}`;
      return [head, ...firstLines.slice(1), ...rest].join("\n");
    })
    .join("\n");
}

function renderTable(table: Table, defs: Definitions): string {
  const rows = table.children.map((row) =>
    row.children.map((cell) =>
      renderInline(cell.children as PhrasingContent[], { plain: true, defs })
    )
  );
  const columns = Math.max(...rows.map((row) => row.length), 0);
  const widths = Array.from({ length: columns }, (_, col) =>
    Math.max(...rows.map((row) => (row[col] ?? "").length), 0)
  );
  const formatRow = (row: string[]) =>
    widths
      .map((width, col) => {
        const value = row[col] ?? "";
        return col < columns - 1 ? value.padEnd(width) : value;
      })
      .join(" | ")
      .trimEnd();
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + 3 * (columns - 1);
  const [header, ...body] = rows;
  const lines = header ? [formatRow(header), "-".repeat(totalWidth)] : [];
  lines.push(...body.map(formatRow));
  return "```\n" + lines.join("\n") + "\n```";
}

function renderBlockNode(
  node: RootContent,
  indent: string,
  defs: Definitions
): string {
  switch (node.type) {
    case "paragraph":
      return renderInline(node.children, { defs });
    case "heading":
      return `*${renderInline(node.children, { suppressStrong: true, defs })}*`;
    case "list":
      return renderList(node, "", defs);
    case "blockquote":
      return renderBlocks(node.children, indent, defs)
        .split("\n")
        .map((line) => (line.length > 0 ? `> ${line}` : ">"))
        .join("\n");
    case "code":
      return "```\n" + node.value + "\n```";
    case "table":
      return renderTable(node, defs);
    case "thematicBreak":
      return "----------";
    case "html":
      return stripTags(node.value).trim();
    case "definition":
      // Consumed by linkReference/imageReference lookups.
      return "";
    case "footnoteDefinition":
      return `[${node.identifier}] ${renderBlocks(node.children, indent, defs)}`;
    default:
      return "children" in node
        ? renderInline(node.children as PhrasingContent[], { defs })
        : "";
  }
}

function renderBlocks(
  nodes: RootContent[],
  indent: string,
  defs: Definitions
): string {
  return nodes
    .map((node) => renderBlockNode(node, indent, defs))
    .filter((part) => part.length > 0)
    .join("\n\n");
}

export function markdownToWhatsAppText(markdown: string): string {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(markdown) as Root;
  const defs: Definitions = new Map();
  collectDefinitions(tree, defs);
  return renderBlocks(tree.children, "", defs);
}

// --------------------------------------------------------------------------
// Markdown → email-safe HTML (inline styles only)
// --------------------------------------------------------------------------

const MONO_FONT =
  "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

const ROOT_STYLE =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" +
  "font-size:15px;line-height:1.55;color:#1f2328";

const TAG_STYLES: Record<string, string> = {
  h1: "font-size:1.6em;font-weight:600;line-height:1.25;margin:0.9em 0 0.45em",
  h2: "font-size:1.35em;font-weight:600;line-height:1.25;margin:0.9em 0 0.45em",
  h3: "font-size:1.17em;font-weight:600;line-height:1.25;margin:0.9em 0 0.45em",
  h4: "font-size:1em;font-weight:600;line-height:1.25;margin:0.9em 0 0.45em",
  h5: "font-size:0.95em;font-weight:600;line-height:1.25;margin:0.9em 0 0.45em",
  h6: "font-size:0.9em;font-weight:600;line-height:1.25;margin:0.9em 0 0.45em",
  p: "margin:0 0 0.8em",
  ul: "margin:0 0 0.8em;padding-left:1.6em",
  ol: "margin:0 0 0.8em;padding-left:1.6em",
  li: "margin:0.2em 0",
  blockquote:
    "margin:0 0 0.8em;padding:0.1em 0 0.1em 1em;border-left:3px solid #d0d7de;color:#59636e",
  code: `${MONO_FONT};font-size:0.9em;background:#f0f1f3;padding:0.15em 0.4em;border-radius:4px`,
  pre: `${MONO_FONT};font-size:0.9em;background:#f6f8fa;padding:12px 14px;border-radius:6px;overflow-x:auto;margin:0 0 0.8em`,
  table: "border-collapse:collapse;margin:0 0 0.8em",
  th: "border:1px solid #d0d7de;padding:6px 12px;background:#f6f8fa;font-weight:600;text-align:left",
  td: "border:1px solid #d0d7de;padding:6px 12px",
  a: "color:#7033ff;text-decoration:underline",
  hr: "border:none;border-top:1px solid #d0d7de;margin:1.2em 0",
  img: "max-width:100%",
};

type HastChild = HastRoot["children"][number] | ElementContent;

const isElement = (node: HastChild): node is Element =>
  node.type === "element";

function styleTree(parent: HastRoot | Element, parentTag?: string): void {
  const children: HastChild[] = parent.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!isElement(child)) continue;
    if (child.tagName === "input" && child.properties?.type === "checkbox") {
      // Form controls are dead weight in emails — swap for a text marker.
      children[i] = {
        type: "text",
        value: child.properties?.checked ? "[x]" : "[ ]",
      };
      continue;
    }
    child.properties ??= {};
    delete child.properties.className;
    sanitizeUrlProperties(child);
    const styleParts: string[] = [];
    const existing = child.properties.style;
    if (typeof existing === "string" && existing.length > 0) {
      styleParts.push(existing);
    }
    // `code` inside `pre` inherits the block styling from `pre` itself.
    const base =
      child.tagName === "code" && parentTag === "pre"
        ? undefined
        : TAG_STYLES[child.tagName];
    if (base) styleParts.push(base);
    if (child.tagName === "th" || child.tagName === "td") {
      // GFM alignment arrives as a deprecated align attribute; inline CSS
      // would beat it, so fold it into the style (last declaration wins).
      const align = child.properties.align;
      if (align === "left" || align === "center" || align === "right") {
        styleParts.push(`text-align:${align}`);
      }
      delete child.properties.align;
    }
    if (styleParts.length > 0) {
      child.properties.style = styleParts.join(";");
    }
    styleTree(child, child.tagName);
  }
}

const URL_PROPERTIES: Record<string, string[]> = {
  a: ["href"],
  img: ["src"],
};

const SAFE_PROTOCOLS = new Set(["http", "https", "mailto", "tel"]);

/**
 * The chat renderer blocks javascript:-style URLs via react-markdown's
 * urlTransform; plain remark-rehype does not, so the export path has to
 * allow-list protocols itself. Relative URLs (no colon before any /?#)
 * are kept.
 */
function sanitizeUrlProperties(el: Element): void {
  for (const prop of URL_PROPERTIES[el.tagName] ?? []) {
    const value = el.properties?.[prop];
    if (typeof value !== "string") continue;
    const colon = value.indexOf(":");
    if (colon === -1) continue;
    const beforeColon = value.slice(0, colon);
    if (/[/?#]/.test(beforeColon)) continue;
    if (!SAFE_PROTOCOLS.has(beforeColon.toLowerCase())) {
      delete el.properties[prop];
    }
  }
}

function rehypeInlineStyles() {
  return (tree: HastRoot) => {
    styleTree(tree);
  };
}

/**
 * Raw HTML is never passed through (no rehype-raw on this path), but dropping
 * it outright loses content the on-screen renderer shows: `<br>` becomes a
 * real break, anything else keeps its text with the tags stripped.
 */
const rawHtmlHandler = (
  _state: unknown,
  node: Html
): ElementContent | undefined => {
  if (/^<br\s*\/?>$/i.test(node.value.trim())) {
    return { type: "element", tagName: "br", properties: {}, children: [] };
  }
  const text = stripTags(node.value).trim();
  return text ? { type: "text", value: text } : undefined;
};

export function markdownToClipboardHtml(markdown: string): string {
  const body = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { handlers: { html: rawHtmlHandler } })
    .use(rehypeInlineStyles)
    .use(rehypeStringify)
    .processSync(markdown)
    .toString();
  return `<div style="${ROOT_STYLE}">${body}</div>`;
}

// --------------------------------------------------------------------------
// Standalone HTML document (download variant)
// --------------------------------------------------------------------------

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function buildMessageHtmlDocument(
  markdown: string,
  options?: { title?: string }
): string {
  const title = escapeHtml(options?.title ?? "Chat message");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${title}</title>`,
    "</head>",
    '<body style="margin:0;background:#ffffff;padding:24px">',
    '<div style="max-width:720px;margin:0 auto">',
    markdownToClipboardHtml(markdown),
    "</div>",
    "</body>",
    "</html>",
  ].join("\n");
}

// --------------------------------------------------------------------------
// Clipboard write with rich + plain flavors
// --------------------------------------------------------------------------

/**
 * Copies a message to the clipboard as `text/html` (email-safe inline styles)
 * plus `text/plain` (WhatsApp-flavored). Returns which flavor set landed on
 * the clipboard; throws when no clipboard API is available at all.
 */
export async function copyMessageFormatted(
  markdown: string
): Promise<"rich" | "plain"> {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard) {
    throw new Error("Clipboard API is not available");
  }
  const text = markdownToWhatsAppText(markdown);
  const ClipboardItemCtor = globalThis.ClipboardItem;
  if (
    typeof clipboard.write === "function" &&
    typeof ClipboardItemCtor === "function"
  ) {
    try {
      await clipboard.write([
        new ClipboardItemCtor({
          "text/html": new Blob([markdownToClipboardHtml(markdown)], {
            type: "text/html",
          }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return "rich";
    } catch {
      // Rich write can be rejected (permissions, unsupported types) —
      // degrade to the plain flavor below.
    }
  }
  if (typeof clipboard.writeText !== "function") {
    throw new Error("Clipboard API is not available");
  }
  await clipboard.writeText(text);
  return "plain";
}
