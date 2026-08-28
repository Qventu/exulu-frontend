// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export interface Item {
    id?: string;
    name?: string;
    description?: string,
    createdAt?: string;
    embeddings_updated_at?: string;
    last_processed_at?: string;
    chunks_count?: number;
    updatedAt?: string;
    // Nullable in the API: items created in-app rather than synced from a
    // source system have no external id. Consumers already read it as
    // `external_id ?? ""` / `|| row.id`.
    external_id?: string | null;
    source?: string;
    tags?: string[];
    textlength?: number;
    chunks?: {
        chunk_id: string;
        chunk_index: number;
        chunk_content: string;
        chunk_metadata: Record<string, any>;
        source: string;
        chunk_created_at: string;
        chunk_updated_at: string;
    }[];
    rights_mode?: 'private' | 'users' | 'roles' | 'teams' | 'public' /* | 'projects' */;
    RBAC?: {
        type?: string;
        users?: Array<{ id: number; rights: 'read' | 'write' }>;
        roles?: Array<{ id: string; rights: 'read' | 'write' }>;
        // projects?: Array<{ id: string; rights: 'read' | 'write' }>;
    };
    [key: string]: any;
}