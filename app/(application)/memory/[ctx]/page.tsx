/**
 * /memory/[ctx] — one memory base (spec §4.3). Server: guard + context fetch,
 * then the client shell owns i18n, stats, list and bulk actions.
 */
import { fetchGraphQLServerSide } from "@/lib/graphql/server";
import { guardRoute } from "@/lib/route-guard";

import { GET_MEMORY_BASE } from "../queries";
import { BaseShell, NotFoundBase } from "./components/base-shell";
import type { MemoryContext } from "./components/memory-list-data";

export default async function MemoryBasePage({
  params,
  searchParams,
}: {
  params: Promise<{ ctx: string }>;
  searchParams: Promise<{ mine?: string; page?: string }>;
}) {
  const denied = await guardRoute("memory");
  if (denied) return denied;
  const { ctx } = await params;
  const sp = await searchParams;
  const data = (await fetchGraphQLServerSide(GET_MEMORY_BASE.loc?.source.body ?? "", { id: ctx })) as
    | { contextById: MemoryContext | null }
    | null
    | undefined;
  const context = data?.contextById ?? null;
  if (!context) return <NotFoundBase contextId={ctx} />;
  return <BaseShell context={context} initialMine={sp.mine === "1"} initialPage={Number(sp.page) || 1} />;
}
