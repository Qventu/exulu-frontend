/**
 * Which citations the tour can open.
 *
 * The citation dialog (components/ai-elements/response.tsx) asks
 * `GetChunkById<ctx>`, which lib/demo/resolvers.ts answers from the items'
 * chunks — and only the software documentation was exported with its
 * chunks (fixtures/software-docs.ts, chunks-ks2xt-de.json). Every other
 * citation in the tour's conversations — chapter 5's Zendesk ticket,
 * chapter 6's manuals and service tickets, chapter 9's parts catalogue —
 * resolves to nothing, and a badge that opens onto "Chunk … not found in
 * context …" with raw ids would be worse than one that does not open. So
 * the badge asks here first: openable citations get the dialog and the
 * inert layer's exemption (data-demo-id="chat-citation"); the rest render
 * as plain badges, as they did before the dialog was let through.
 *
 * Keyed on the chunk id alone: ids are UUIDs, unique across contexts.
 */
import { SOFTWARE_DOC_ITEMS } from "./fixtures/software-docs";

const OPENABLE_CHUNK_IDS: ReadonlySet<string> = new Set(
  SOFTWARE_DOC_ITEMS.flatMap((item) => item.chunks?.map((chunk) => chunk.chunk_id) ?? []),
);

export function demoCitationOpenable(chunkId: string): boolean {
  return OPENABLE_CHUNK_IDS.has(chunkId);
}
