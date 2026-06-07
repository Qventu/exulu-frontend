import { DataList } from "@/app/(application)/data/components/data-list";
import {
    TooltipProvider,
} from "@/components/ui/tooltip";
import Contexts from "@/app/(application)/data/[[...query]]/contexts";

export default async function DataLayout({ children, params }: {
    children: any,
    params: Promise<{ query?: string[] }>;
}) {

    const { query } = await params;
    const archived = query && query[1] === "archived";
    const sources = query && query[1] === "sources";
    const embeddings = query && query[1] === "embeddings";
    const processors = query && query[1] === "processors";
    const entityTypes = query && query[1] === "entity-types";
    const context: string | null | undefined = query && query[0];

    let item: string | null = null;
    if (query && archived) {
        item = query[2] || null;
    } else if (query && !sources && !embeddings && !processors && !entityTypes) {
        item = query[1] || null;
    }

    return (
        <TooltipProvider delayDuration={0}>
            <div className="h-full items-stretch flex flex-row">
                <Contexts
                    activeFolder={context}
                    activeArchived={archived}
                    activeSources={sources}
                    activeEmbeddings={embeddings}
                    activeProcessors={processors}
                    activeEntityTypes={entityTypes}
                />
                {
                    context && !sources && !embeddings && !processors && !entityTypes && <div className="flex flex-col h-full border-r">
                        <DataList
                            activeFolder={context}
                            activeItem={item ?? undefined}
                            archived={archived || false}
                        />
                    </div>
                }
                <div className="max-h-full w-full overflow-y-auto">
                    {children}
                </div>
            </div>
        </TooltipProvider>
    );
}