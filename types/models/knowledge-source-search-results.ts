// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export interface KnowledgeSourceSearchResultChunk {
    chunk_content: string,
    chunk_index: number,
    chunk_id: string,
    chunk_source: string,
    chunk_metadata: Record<string, string>,
    chunk_created_at: string,
    chunk_updated_at: string,
    item_id: string,
    item_external_id: string,
    item_name: string,
    item_updated_at: string,
    item_created_at: string,
    context: {
        name: string,
        id: string
    }
}

export interface AgenticKnowledgeSourceSearchResults {
    reasoning: {
        text: string;
        tools: {
            name: string;
            id: string;
            input: any;
            output: any;
        }[]
    }[]
    text: string[]  
    tools: any[]
    chunks: KnowledgeSourceSearchResultChunk[]
}