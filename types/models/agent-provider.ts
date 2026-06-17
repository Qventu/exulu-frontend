// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export interface ExuluProvider {
    id: string
    name: string
    provider: string
    providerName: string
    description: string
    enable_batch: boolean
    inputSchema: any;
    slug: string
    type: string
}