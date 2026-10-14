import { describe, expect, it } from "vitest";
import { parseMarkdownIntoBlocks } from "streamdown";

import { blockOffsets, sentencesInBlock } from "./claim-check-highlight";

// The premise this whole module relies on: streamdown's block splitter must
// be lossless (join() reconstructs the original string exactly), or a running
// offset over the block list does not locate each block's real position in
// the answer. Measured with a throwaway probe script against realistic
// answers — German umlauts, a list, a fenced code block, a table, and runs of
// consecutive blank lines — and found lossless in every case (see
// task-F6-report.md for the probe's exact code and output). This test pins
// that finding so a streamdown upgrade that breaks it fails loudly here,
// rather than drifting highlights silently.
describe("parseMarkdownIntoBlocks losslessness (the premise this module relies on)", () => {
  const answers = [
    "Die FST-2XT arbeitet mit 230 Volt. Sie sitzt im Schaltschrank.",
    "## Fehlerbehebung\n\nDer Schalter ist eine Ursache.\n\n- Punkt eins\n- Punkt zwei\n\nAbschließend gilt: geprüft.",
    "Erste Zeile.\nZweite Zeile.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```bash\necho hi\n```\n\nEnde.",
    "Die Prüfung ergab, dass die Übergabe über 230 Volt läuft. Die Ausführung muss überprüft werden, bevor der Schaltschrank geöffnet wird. Abschließend grüßt die Prüferin höflich.",
    "Erste Zeile.\n\n\n\nZweite Zeile nach mehreren Leerzeilen.\n\n\n\n\nDritte Zeile.",
    "## Prüfbericht\n\n\n\nDie Spannung überschreitet 230 Volt nicht.\n\n- Prüfpunkt eins: bestätigt\n- Prüfpunkt zwei: überprüft\n\n\n| Größe | Wert |\n| - | - |\n| Spannung | 230V |\n\n```bash\necho \"Prüfung abgeschlossen\"\n```\n\n\nEnde der Prüfung.",
  ];

  it.each(answers)("reconstructs the input exactly via blocks.join('')", (answer) => {
    const blocks = parseMarkdownIntoBlocks(answer);
    expect(blocks.join("")).toBe(answer);
  });
});

describe("blockOffsets", () => {
  it("returns each block's start offset in the joined answer", () => {
    expect(blockOffsets(["Eins. ", "Zwei. ", "Drei."])).toEqual([0, 6, 12]);
  });

  it("is empty for no blocks", () => {
    expect(blockOffsets([])).toEqual([]);
  });
});

describe("sentencesInBlock", () => {
  const sentences = [
    { index: 0, start: 0, end: 5, state: "checked", claimIds: ["c1"] },
    { index: 1, start: 6, end: 11, state: "no_verifiable_content", claimIds: [] },
    { index: 2, start: 12, end: 17, state: "checked", claimIds: ["c2"] },
  ] as never[];

  it("selects only the sentences that fall inside the block's range", () => {
    expect(sentencesInBlock(sentences, 6, 12).map((s) => s.index)).toEqual([1]);
  });

  it("excludes a sentence that merely straddles the boundary, rather than half-highlighting it", () => {
    expect(sentencesInBlock(sentences, 3, 8).map((s) => s.index)).toEqual([]);
  });

  it("returns an empty list when the block holds no sentences", () => {
    expect(sentencesInBlock(sentences, 100, 200)).toEqual([]);
  });
});
