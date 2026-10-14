// Mapping the check's whole-answer sentence offsets onto the per-block render
// in components/ai-elements/response.tsx, which splits an answer with
// streamdown's parseMarkdownIntoBlocks before rendering each block through its
// own ReactMarkdown. A running offset over the block list is only valid
// because the splitter was measured to be lossless (join() === input); if that
// ever changes, highlights would drift silently and this must be revisited.
// See claim-check-highlight.test.ts and task-F6-report.md for the measurement.
//
// NOT YET SAFE TO WIRE IN. This module's offsets are correct relative to
// answerTextOf(message) — the string the backend actually segmented — but
// components/message-renderer.tsx does not render that string. It loops over
// message.parts and renders each text part through its own <Response> call
// (not one call over the whole joined answer), and before that render it
// mutates the part's text: stripping `<file name="...">...</file>` tags, and
// replacing citation-shaped `{item_name: ...}` / `{url: ...}` blobs with
// `<cite-marker-knowledge-source>` / `<cite-marker-web-search>` elements.
// Both mutations change the string's length and content, so the string
// actually painted to the screen is frequently NOT character-identical to
// answerTextOf(message) — exactly for the cited answers this feature targets.
// Before wiring a <mark> into response.tsx, measure whether the rendered
// string stays character-identical to answerTextOf for real checked answers
// (with and without citations); if it doesn't, these offsets would be
// correct relative to the wrong string and highlights would land on the
// wrong words. See task-F6-report.md, "The response.tsx rendering decision".
import type { ClaimCheckSentence } from "@/lib/api/claim-check";

export function blockOffsets(blocks: string[]): number[] {
  const offsets: number[] = [];
  let at = 0;
  for (const block of blocks) {
    offsets.push(at);
    at += block.length;
  }
  return offsets;
}

/**
 * Sentences wholly inside [blockStart, blockEnd). A sentence straddling the
 * boundary is dropped rather than half-marked: half a highlighted sentence
 * reads as a different claim than the one that was checked.
 */
export function sentencesInBlock(
  sentences: ClaimCheckSentence[],
  blockStart: number,
  blockEnd: number,
): ClaimCheckSentence[] {
  return sentences.filter((s) => s.start >= blockStart && s.end <= blockEnd);
}
