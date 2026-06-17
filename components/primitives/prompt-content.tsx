"use client";

/**
 * PromptContent — safe `{{variable}}` chip renderer for prompt-library
 * content blocks.
 *
 * Spec: design/codebase-structure.md §2.3 (PromptContent —
 * `{ content: string }`; first consumer: prompts detail, chat prompt
 * selector, future evals). Extracted from the inline pattern in
 * `app/(application)/chat/components/prompt-selector-modal.tsx`.
 *
 * Replaces the legacy `dangerouslySetInnerHTML` regex highlight in
 * prompt-preview (prompts.md H3: stored-XSS surface for shared/public
 * prompts, and the single-brace `\{var\}` regex mangled the actual
 * `{{var}}` content). The body is split on a literal
 * `(\{\{[a-zA-Z0-9_]+\}\})` token and the alternating segments render as
 * plain `<span>` (preserves whitespace via `whitespace-pre-wrap` on the
 * outer element) and `<Badge variant="secondary">` chips — React escapes
 * everything; nothing is interpreted as HTML.
 *
 * Tokens only — no semantic-color confetti (philosophy §4 / design-system
 * R1). The container is the consumer's choice; this component renders an
 * inline-content `<pre>` and lets the parent wrap it.
 */

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PromptContentProps
  extends Omit<React.HTMLAttributes<HTMLPreElement>, "children"> {
  /** The raw prompt body (potentially containing `{{variable}}` tokens). */
  content: string;
}

// Capturing split keeps the delimiters as alternating array entries; the
// regex matches the same variable shape the rest of the prompts module
// considers valid (`[a-zA-Z0-9_]+`).
const TOKEN_SPLIT_RE = /(\{\{[a-zA-Z0-9_]+\}\})/g;
const TOKEN_MATCH_RE = /^\{\{([a-zA-Z0-9_]+)\}\}$/;

const PromptContent = React.forwardRef<HTMLPreElement, PromptContentProps>(
  ({ content, className, ...props }, ref) => {
    const parts = React.useMemo(
      () => (content ? content.split(TOKEN_SPLIT_RE) : []),
      [content],
    );

    return (
      <pre
        ref={ref}
        className={cn(
          "whitespace-pre-wrap break-words font-mono text-sm leading-relaxed",
          className,
        )}
        {...props}
      >
        {parts.map((part, index) => {
          const match = part.match(TOKEN_MATCH_RE);
          if (!match) {
            return <span key={index}>{part}</span>;
          }
          return (
            <Badge
              key={index}
              variant="secondary"
              className="mx-0.5 align-baseline font-mono text-xs"
            >
              {`{{${match[1]}}}`}
            </Badge>
          );
        })}
      </pre>
    );
  },
);
PromptContent.displayName = "PromptContent";

export { PromptContent };
