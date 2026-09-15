"use client";

import { motion } from "framer-motion";

import type { ContentBlock } from "@/lib/demo/content";

/**
 * A step's content, rendered.
 *
 * Deliberately thin: every decision about WHAT a step says lives in
 * lib/demo/chapters as data, so it stays testable in node. This file decides
 * only how a block looks.
 */
function Block({ block }: { block: ContentBlock }) {
  switch (block.kind) {
    case "paragraph":
      return <p className="demo-block-paragraph">{block.text}</p>;
    case "bullets":
      return (
        <ul className="demo-block-bullets">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <blockquote className={`demo-block-callout demo-callout-${block.tone}`}>
          {block.text}
        </blockquote>
      );
    case "stat":
      return (
        <div className="demo-block-stat">
          <span className="demo-stat-value">{block.value}</span>
          <span className="demo-stat-label">{block.label}</span>
        </div>
      );
    case "figure":
      // The drawings are OPEN-brand collage on an opaque lime field, not
      // transparency — see scripts/generate-demo-image.py for the house style
      // and why the request deliberately drops "background": "transparent".
      //
      // Plain <img>, not next/image — and the original reason (this rendered
      // inside step-content-host's detached createRoot, outside the Next
      // tree) died with that file. Kept deliberately all the same: every
      // figure is a build-time asset under /public at a fixed 800x534,
      // rendered into a 380/560px panel or a 768px scene column and capped
      // by .demo-block-figure's max-height, so there is no layout shift to
      // reserve against and nothing for the optimiser to save. Switching it
      // would buy a demo-only route an image-optimisation round trip on a
      // server whose only job is this walkthrough.
      return <img className="demo-block-figure" src={block.src} alt={block.alt ?? ""} />;
    case "sequence":
      return (
        <ol className="demo-block-sequence">
          {block.steps.map((label, index) => (
            <motion.li
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              // Staggered so a pipeline reads left to right as a process
              // rather than appearing all at once as a list.
              transition={{ delay: index * 0.12, duration: 0.28 }}
            >
              {label}
            </motion.li>
          ))}
        </ol>
      );
    default: {
      // Adding a ContentBlock kind without handling it here is a compile
      // error, not a silently blank block. tsconfig sets `strict` but not
      // `noImplicitReturns`, so without this a missed case would fall through
      // the switch and render nothing rather than fail the build — the same
      // reasoning contentText in lib/demo/content.ts already makes for
      // itself. `never` is a subtype of every type, JSX.Element included, so
      // `return unhandled` type-checks against this function's inferred
      // return type without needing one spelled out.
      const unhandled: never = block;
      return unhandled;
    }
  }
}

/**
 * Two mounts, neither sharing the other's full context: the docked panel
 * (components/demo/tour-panel.tsx) and a scene page
 * (app/(application)/demo/szene/[id]/page.tsx). Both are normal React-tree
 * renders now — the third mount, a detached `createRoot` with no providers
 * at all (components/demo/step-content-host.tsx), existed only to hand
 * Shepherd's `text` option an HTMLElement, and was deleted with the rest of
 * Shepherd.
 *
 * The two survivors still diverge: TourOverlay (and this panel with it) sits
 * as a sibling of <main> in app/(application)/layout.tsx, inside
 * ThemeProvider/LanguageProvider but OUTSIDE Authenticated's ApolloProvider —
 * while the scene page is the other way around, inside ApolloProvider but
 * outside TourProvider. Keep this component (and `Block` above) free of
 * Apollo hooks and `useTour()`: each throws in the mount that lacks it.
 * Theme and next-intl are safe — both providers wrap both mounts.
 *
 * Takes BLOCKS, not a step: one mount's blocks come from `step.content`, the
 * other's from lib/demo/scenes.ts, and the scene page used to assemble a
 * whole fake DemoStep (with a duplicate title on it) just to get them in.
 */
export function StepPanel({ content }: { content: ContentBlock[] }) {
  return (
    <motion.div
      className="demo-step-panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {content.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </motion.div>
  );
}
