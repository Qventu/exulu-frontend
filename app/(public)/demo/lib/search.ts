import type {Article, SearchMode} from "../types"

// Simulates different search methods
export async function performSearch(
    query: string,
    mode: SearchMode,
    maxCosineDistance = 0.8,
): Promise<Article[] | {
    result: string,
    sources: Article[]
}> {
    // Simulate network delay
    switch (mode) {
        case "bm25":
            return await performBM25Search(query)
        case "vector":
            return await performVectorSearch(query, maxCosineDistance)
        case "rag":
            return await performRAGSearch(query, maxCosineDistance)
        default:
            return []
    }
}

async function performBM25Search(query: string): Promise<Article[]> {

    return []

    /* const response: any = await embedders.retrieve(
        "67e5492ad08a543488539119",
        "bb2816f4-64ba-4358-963b-eaff3c406e0e",
        query,
        {
            mode: "bm25"
        }
    ); */

    // const json = await response.json();

    // const embeddings: Embedding[] = json.objects;

    /* return embeddings ? embeddings.map(x => ({
        id: x.uuid,
        title: x.properties?.original_title || "Placeholder title",
        content: x.properties?.original_content,
        excerpt: x.properties?.original_content?.slice(0, 250),
        category: "faq",
        relevanceScore: 1 - (x.metadata?.distance || 0),
        date: new Date().toDateString(),
        readTime: 2,
        imageUrl: x.properties?.original_image || ""
    })) : [] */
}

async function performVectorSearch(query: string, maxCosineDistance = 0.8): Promise<Article[]> {

    // todo
    return []

    /* const response: any = await embedders.retrieve(
        "67e5492ad08a543488539119",
        "bb2816f4-64ba-4358-963b-eaff3c406e0e",
        query,
        {
            mode: "vector",
            max_distance: maxCosineDistance
        }
    );

    const json = await response.json();

    const embeddings: Embedding[] = json.objects;

    return embeddings ? embeddings.map(x => ({
        id: x.uuid,
        title: x.properties?.original_title || "Placeholder title",
        content: x.properties?.original_content,
        excerpt: x.properties?.original_content?.slice(0, 250),
        category: "faq",
        relevanceScore: 1 - (x.metadata?.distance || 0),
        date: new Date().toDateString(),
        readTime: 2,
        imageUrl: x.properties?.original_image || ""
    })) : [] */
}

async function performRAGSearch(query: string, maxCosineDistance = 0.8): Promise<{
    result: string,
    sources: Article[]
}> {

    return {
        result: "",
        sources: []
    }

    /* const response: any = await embedders.retrieve(
        "67e5492ad08a543488539119",
        "bb2816f4-64ba-4358-963b-eaff3c406e0e",
        query,
        {
            mode: "rag",
            max_distance: maxCosineDistance
        }
    );

    const json = await response.json();
    const sources: Embedding[] = json.sources;

    return {
        result: `${json.result}`,
        sources: sources ? sources.map(x => ({
            id: x.uuid,
            title: x.properties?.original_title || "Placeholder title",
            content: x.properties?.original_content,
            excerpt: x.properties?.original_content?.slice(0, 250),
            category: "faq",
            relevanceScore: 1 - (x.metadata?.distance || 0),
            date: new Date().toDateString(),
            readTime: 2,
            imageUrl: x.properties?.original_image || ""
        })) : []
    } */
}

