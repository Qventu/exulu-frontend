"use client";

import { motion } from "framer-motion";

import type { ContentBlock } from "@/lib/demo/content";
import type { DemoStep } from "@/lib/demo/tour";

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
      // The drawings are OPEN-brand collage on transparency; see
      // scripts/generate-demo-image.py for the house style.
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

export function StepPanel({ step }: { step: DemoStep }) {
  return (
    <motion.div
      className="demo-step-panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {step.content.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </motion.div>
  );
}
