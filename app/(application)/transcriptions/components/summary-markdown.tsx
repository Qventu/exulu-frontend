"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { secondsFromSeekHref, timestampRefsToLinks } from "../linkify";

/**
 * Renders a post-processing output as markdown.
 *
 * Summary prompts return markdown — headings, bullets, bold, the occasional
 * table — and this used to be printed with `whitespace-pre-wrap`, so readers
 * saw `###` and `**bold**` literally. The repo has no typography plugin, so
 * every element is styled explicitly here rather than through `prose`, at the
 * document's own small type scale.
 *
 * `[mm:ss]` passage references survive: they are rewritten to `#t=` links
 * before parsing and intercepted below, so they stay seek buttons rather than
 * becoming literal brackets (markdown would read `[12:34]` as a destination-less
 * link and print it verbatim).
 *
 * `onSeek` is optional: the review page's post-processing card renders the same
 * markdown with no player attached, so a reference there is shown as plain text
 * rather than a button that would do nothing.
 */
export function SummaryMarkdown({
  text,
  onSeek,
}: {
  text: string;
  onSeek?: (seconds: number) => void;
}) {
  const source = React.useMemo(() => timestampRefsToLinks(text), [text]);

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <p className="text-base font-semibold">{children}</p>,
          h2: ({ children }) => <p className="text-sm font-semibold">{children}</p>,
          h3: ({ children }) => <p className="text-sm font-semibold">{children}</p>,
          h4: ({ children }) => (
            <p className="text-sm font-medium text-muted-foreground">{children}</p>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          hr: () => <hr className="border-t" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{children}</pre>
          ),
          // Wide tables scroll inside their own container; the column must not.
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b px-2 py-1 text-left font-medium">{children}</th>
          ),
          td: ({ children }) => <td className="border-b px-2 py-1 align-top">{children}</td>,
          a: ({ href, children }) => {
            const seconds = secondsFromSeekHref(href);
            if (seconds !== null && !onSeek) {
              return <span className="font-mono text-xs">{children}</span>;
            }
            if (seconds !== null && onSeek) {
              return (
                <button
                  type="button"
                  onClick={() => onSeek(seconds)}
                  className="mx-0.5 inline-flex rounded border px-1 align-baseline font-mono text-xs text-primary hover:bg-muted"
                >
                  {children}
                </button>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
