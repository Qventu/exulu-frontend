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
        index: number;
        content: string;
        source: string;
        embedding: number;
        createdAt: string;
        updatedAt: string;
    }[];
    [key: string]: any;
}