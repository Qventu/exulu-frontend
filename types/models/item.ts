export interface Item {
    id?: string;
    name?: string;
    description?: string,
    createdAt?: string;
    updatedAt?: string;
    external_id?: string;
    source?: string;
    tags?: string[];
    textLength?: number;
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