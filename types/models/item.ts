export interface Item {
    id?: string;
    name?: string;
    description?: string,
    createdAt?: string;
    embeddings_updated_at?: string;
    updatedAt?: string;
    external_id?: string;
    source?: string;
    tags?: string[];
    textlength?: number;
    chunks?: {
        id: string;
        chunk_index: number;
        content: string;
        source: string;
        embedding_size: number;
        chunk_created_at: string;
        chunk_updated_at: string;
    }[];
    rights_mode?: 'private' | 'users' | 'roles' | 'public' | 'projects';
    RBAC?: {
        type?: string;
        users?: Array<{ id: number; rights: 'read' | 'write' }>;
        roles?: Array<{ id: string; rights: 'read' | 'write' }>;
        projects?: Array<{ id: string; rights: 'read' | 'write' }>;
    };
    [key: string]: any;
}