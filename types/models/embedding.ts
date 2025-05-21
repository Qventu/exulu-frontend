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