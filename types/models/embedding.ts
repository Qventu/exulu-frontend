// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export interface Embedding {
        collection: string
        metadata: {
            certainty: number
            creation_time?: string
            distance?: number
        }
        uuid: string
        properties: {
            chunk_count: string
            chunk_index: string
            external_id: string
            original_content: string
            original_image: string
            original_title: string
        }
    }