/**
 * A tour step's copy, as data rather than markup.
 *
 * The tour's explainers are panels now — headings, lists, statistics,
 * sequences — and the obvious way to express that is JSX in the chapter list.
 * That would be a mistake: vitest runs this project with environment "node"
 * and collects only *.test.ts, so JSX in the chapter list would move every
 * line of the tour's script beyond the reach of any assertion.
 *
 * As data, the script stays testable — copy, ordering, structure, emptiness —
 * and components/demo/step-panel.tsx stays a thin mapping over it. Same
 * argument shepherd-step.ts already makes for itself: "a component that only
 * runs in a browser is a component nobody asserts on."
 */
export type ContentBlock =
  | { kind: "paragraph"; text: string }
  /** Short parallel points. Not for prose — three words to a line, not three sentences. */
  | { kind: "bullets"; items: string[] }
  /** A pulled-out claim. `quote` is someone's words; `fact` is the product's. */
  | { kind: "callout"; tone: "fact" | "quote"; text: string }
  /** One number that carries a step, e.g. 1.000 Dokumente. */
  | { kind: "stat"; value: string; label: string }
  | { kind: "figure"; src: string; alt?: string }
  /** An ordered pipeline, rendered as connected stages. */
  | { kind: "sequence"; steps: string[] };

/** Every word in a block, for assertions and search. Never renders. */
export function contentText(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "paragraph":
          return block.text;
        case "bullets":
          return block.items.join(" ");
        case "callout":
          return block.text;
        case "stat":
          return `${block.value} ${block.label}`;
        case "figure":
          return block.alt ?? "";
        case "sequence":
          return block.steps.join(" ");
        default: {
          // Adding a ContentBlock kind without handling it here is a compile
          // error, not a silently dropped string. tsconfig sets `strict` but
          // not `noImplicitReturns`, so without this the return type would
          // quietly widen to `string | undefined` and the new kind's text
          // would vanish from every assertion that reads it.
          const unhandled: never = block;
          return unhandled;
        }
      }
    })
    .join(" ");
}

/** True when a step would render a title over nothing. */
export function isEmptyContent(blocks: ContentBlock[]): boolean {
  return contentText(blocks).trim().length === 0;
}
