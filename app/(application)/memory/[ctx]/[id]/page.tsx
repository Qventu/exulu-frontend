/** /memory/[ctx]/[id] — one memory (spec §4.4). Server: guard + context, client detail. */
import { fetchGraphQLServerSide } from "@/lib/graphql/server";
import { guardRoute } from "@/lib/route-guard";

import { GET_MEMORY_BASE } from "../../queries";
import { NotFoundBase } from "../components/base-shell";
import type { MemoryContext } from "../components/memory-list-data";
import { MemoryDetail } from "./components/memory-detail";

export default async function MemoryDetailPage({ params }: { params: Promise<{ ctx: string; id: string }> }) {
  const denied = await guardRoute("memory");
  if (denied) return denied;
  const { ctx, id } = await params;
  const data = (await fetchGraphQLServerSide(GET_MEMORY_BASE.loc?.source.body ?? "", { id: ctx })) as
    | { contextById: MemoryContext | null } | null | undefined;
  const context = data?.contextById ?? null;
  if (!context) return <NotFoundBase contextId={ctx} />;
  return <MemoryDetail context={context} itemId={id} />;
}
