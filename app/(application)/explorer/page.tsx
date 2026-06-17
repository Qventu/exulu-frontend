import React from 'react';
import GraphiQLComponent from "@/app/(application)/explorer/graphiql";
import { guardRoute } from "@/lib/route-guard";

export const dynamic = 'force-dynamic'

export default async function Graphiql() {
    // Route guard for /explorer — gate from nav-config ("explorer"):
    // SA || role.api:w (navigation.md §1.2/§1.3 rule 5; closes the
    // /explorer open-by-URL gap). Until the backend populates `api` in
    // serverSideAuthCheck's role object this collapses to super_admin
    // in practice (explorer.md U2).
    const denied = await guardRoute("explorer");
    if (denied) return denied;

    return <GraphiQLComponent/>
}
