import React from 'react';
import GraphiQLComponent from "@/app/(application)/explorer/graphiql";

export const dynamic = 'force-dynamic'

export default async function Graphiql() {
    return <GraphiQLComponent/>
}