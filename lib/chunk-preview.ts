/**
 * Strips the document preamble the processor prepends to every chunk before
 * the chunk is shown to a human.
 *
 * The preamble is not noise in the DATA — it is deliberate. Each chunk is
 * embedded together with a header naming the document it came from, so the
 * vector carries document-level context and a passage retrieved in isolation
 * still knows what it belongs to. It has to stay in `chunk_content`.
 *
 * It is noise on SCREEN, though, and identical on every chunk of a document:
 *
 *     --- Document (Exulu ID: d92dd3f2-2803-41e4-8136-a1a0ccb99e6c) ---
 *     Document Name: FST2XTchanges-customer-DE.docx
 *     -------------------------
 *
 * The chunks table line-clamps previews to three lines, which is exactly the
 * height of that block — so every row of a document renders as the same three
 * lines and the table shows nothing about the chunks. (In the Newlift
 * deployment this is 244 of 244 chunks in the software documentation context.)
 * The citation dialog has the same problem for a different reason: it already
 * names the document in its title and again in its metadata table, so the
 * preamble is the third copy.
 *
 * Display-only. Nothing here touches what is stored, embedded or searched.
 */

/**
 * Matched strictly, and anchored to the start. If the shape is not exactly
 * what the processor emits, the content is returned untouched — the failure we
 * want is "preamble still visible", never "the first lines of somebody's
 * document silently disappeared".
 */
const DOCUMENT_PREAMBLE =
  /^\s*---\s*Document \(Exulu ID:[^)]*\)\s*---[ \t]*\r?\n\s*Document Name:[^\r\n]*\r?\n\s*-{5,}[ \t]*\r?\n/;

/**
 * The markdown converter emits a page marker at the top of each page. As an
 * HTML comment it renders as literal text in the table, and a chunk that
 * begins at a page boundary leads with it. Only a LEADING marker is removed;
 * ones inside the body are left alone, since there they genuinely separate
 * pages of content.
 */
const LEADING_PAGE_MARKER = /^\s*<!--\s*Current page:\s*\d+\s*-->[ \t]*\r?\n?/;

export function chunkPreviewText(content: string): string {
  if (!content) return "";
  return content
    .replace(DOCUMENT_PREAMBLE, "")
    .replace(LEADING_PAGE_MARKER, "")
    .trim();
}
