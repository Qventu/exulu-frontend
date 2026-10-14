// Mapping the check's whole-answer sentence offsets onto the per-block render
// in components/ai-elements/response.tsx, which splits an answer with
// streamdown's parseMarkdownIntoBlocks before rendering each block through its
// own ReactMarkdown. A running offset over the block list is only valid
// because the splitter was measured to be lossless (join() === input); if that
// ever changes, highlights would drift silently and this must be revisited.
// See claim-check-highlight.test.ts and task-F6-report.md for the measurement.
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
