export interface Item {
    id?: string;
    name?: string;
    description?: string,
    createdAt?: string;
    embeddings_updated_at?: string;
    last_processed_at?: string;
    chunks_count?: number;
    updatedAt?: string;
    external_id?: string;
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