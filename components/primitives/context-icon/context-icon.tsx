"use client";

/**
 * ContextIcon — renders a single bundled Fluent Emoji Flat glyph (the colorful
 * "emoji-like" icons knowledge bases use to make the library easier to scan).
 *
 * Glyph data is bundled locally in ./fluent-emoji-data.ts (no runtime Iconify
 * CDN call). When the requested name is unknown — or none is set — it falls
 * back to DEFAULT_CONTEXT_ICON so a row always shows *something*.
 *
 * To extend the set, re-fetch from the Iconify batch API and regenerate
 * fluent-emoji-data.ts:
 *   curl "https://api.iconify.design/fluent-emoji-flat.json?icons=name1,name2,..."
 * then map each {body,width,height} into FLUENT_EMOJI_GLYPHS.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

import {
  DEFAULT_CONTEXT_ICON,
  FLUENT_EMOJI_GLYPHS,
} from "./fluent-emoji-data";

export interface ContextIconProps
  extends Omit<React.SVGProps<SVGSVGElement>, "name"> {
  /** Glyph name from FLUENT_EMOJI_GLYPHS; falls back to the default. */
  name?: string | null;
}

export function ContextIcon({ name, className, ...props }: ContextIconProps) {
  const glyph =
    (name && FLUENT_EMOJI_GLYPHS[name]) ||
    FLUENT_EMOJI_GLYPHS[DEFAULT_CONTEXT_ICON];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${glyph.width} ${glyph.height}`}
      role="img"
      aria-hidden="true"
      className={cn("size-full", className)}
      dangerouslySetInnerHTML={{ __html: glyph.body }}
      {...props}
    />
  );
}
