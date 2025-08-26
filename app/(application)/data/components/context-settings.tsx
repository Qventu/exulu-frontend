"use client"

import { useQuery as useApolloQuery } from "@apollo/client";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    Bot,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useEffect, useState } from "react";
import {
    GET_AGENTS,
} from "@/queries/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { contexts } from "@/util/api";
import { Embedding } from "@EXULU_SHARED/models/embedding";
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton";
import { RecentEmbeddings } from "@/components/custom/recent-embeddings";

interface DataDisplayProps {
    expand: boolean;
    actions: boolean;
    context: string
}

export function ContextSettings(props: DataDisplayProps) {

    const { data, isLoading, error } = useTanstackQuery({
        queryKey: ["context", props.context],
        queryFn: async () => {
            const response = await contexts.get({ id: props.context });
            const json = await response.json()
            return json;
        },
    });

    const [search, setSearch] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [filterForm, setFilterForm] = useState(false);
    const [filterCount, setFilterCount] = useState<number>();
    const [editing, setEditing] = useState(false);
    const router = useRouter();
    const [query, setQuery] = useState<{
        base: {};
        decorated: {}
    }>({
        base: {},
        decorated: {}
    });
    useEffect(() => {
        if (!query?.base) {
            setFilterCount(0);
            return;
        }
        setFilterCount(
            Object.keys(query?.base).length
        );
    }, [query]);
    useEffect(() => {
        if (!data?.name) {
            return;
        }
        getEmbeddings();
    }, [search]);

    const getEmbeddings = async () => {

        const backend = data.embedder;
        if (!backend) {
            return;
        }
        setLoading(true);
        // const response: any = await embedders.retrieve(data.id, backend, search); todo
        // todo connect to FastAPI embedder
        // const json = await response.json();
        // setEmbeddings(json.objects);
        setLoading(false);
    };

    if (isLoading) {
        return (
            <>
                <div className="min-h-screen flex flex-col items-center justify-center mt-5">
                    Loading...
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <div className="min-h-screen flex flex-col items-center justify-center mt-5">
                    {error.message}
                </div>
            </>
        );
    }

    if (!data) {
        return (
            <>
                <div className="min-h-screen flex flex-col items-center justify-center mt-5">
                    No context found.
                </div>
            </>
        );
    }



    return (
        <div className="flex h-full flex-col">
            {props.actions ? (
                <>
                    <div className="flex p-2 justify-between">
                        <div className="flex items-center gap-2"></div>
                        <Button
                            onClick={() => {
                                router.push("/context");
                            }}
                            variant="ghost"
                            size="icon">
                            <ArrowLeft className="size-4" />
                            <span className="sr-only">Back</span>
                        </Button>
                    </div>
                    <Separator />
                </>
            ) : null}
            {data ? (
                <div className="flex flex-1 flex-col">
                    <Card className="border-0 rounded-none">
                        <CardHeader>
                            <CardTitle className="text-lg">Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <ScrollArea className="max-h-[600px]">
                                <div className="space-y-6 pr-4">
                                    <div>
                                        <h2 className="text-xl font-bold">{data.name}</h2>
                                        <p className="text-muted-foreground mt-1">{data.description}</p>
                                        <div className="mt-3 flex items-center">
                                            <span className="text-sm font-medium mr-2">Embedder:</span>
                                            <Badge variant="outline">{data.embedder || "None"}</Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium mr-2">Calculate Vectors:</span>
                                        <Badge variant="secondary">
                                            {data.configuration?.calculateVectors
                                                ? data.configuration.calculateVectors.charAt(0).toUpperCase() + data.configuration.calculateVectors.slice(1)
                                                : "Manual"}
                                        </Badge>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        <span className="block"><b>Manual</b>: Vectors are only calculated when triggered manually.</span>
                                        <span className="block"><b>On Update</b>: Vectors are recalculated whenever an item is updated.</span>
                                        <span className="block"><b>On Insert</b>: Vectors are calculated when a new item is inserted.</span>
                                        <span className="block"><b>Always</b>: Vectors are calculated on both insert and update operations.</span>
                                    </div>
                                    </div>
                                    <Separator />
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* TODO change to show recently updated or generated embeddings based on the embeddings_updated_at field on the context items */}
                    <Card className="bg-none border-0 rounded-none">
                        <CardHeader>
                            <CardTitle>Recent embedding generations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RecentEmbeddings
                                contextId={data.id}
                            />
                        </CardContent>
                    </Card>

                    {/* <Card className="border-0 border-t-2 rounded-none">
                        <CardHeader>
                            <CardTitle className="text-lg">Bulk actions</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                        <div className="flex flex-col-2 gap-2">
                                <DeleteEmbeddings
                                    disabled={!editing}
                                    backend={data.embedder}
                                    onDelete={() => {
                                        getEmbeddings();
                                    }}
                                    context={data}
                                />
                                <GenerateEmbeddings
                                    context={data}
                                    disabled={!editing}
                                    backend={data.embedder} />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 border-t-2 rounded-none">
                        <CardHeader>
                            <CardTitle className="text-lg">Query tester</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                                <Input
                                    onKeyUp={(e) => {
                                        setSearch(e.currentTarget.value);
                                    }}
                                    placeholder="Search"
                                    className="pl-8"
                                />
                            </div>

                            {!embeddings?.length && loading ? (
                                <p>Loading...</p>
                            ) : embeddings ? (
                                embeddings.map(
                                    (embedding) => {
                                        return (
                                            <Card>
                                                <CardHeader>
                                                    <CardContent className="p-0">
                                                        {search && (
                                                            <Badge variant={"outline"} className="mb-2">
                                                                score {1 - (embedding.metadata?.distance || 0)}
                                                            </Badge>
                                                        )}
                                                        <Badge
                                                            className="ml-2 mb-2 cursor-pointer hover:underline"
                                                            onClick={async () => {
                                                                router.push(
                                                                    "/data/all/" + embedding.properties.external_id,
                                                                );
                                                            }}
                                                            variant={"outline"}
                                                        >
                                                            {embedding.properties.external_id}
                                                        </Badge>

                                                        <TextPreview
                                                            sliceLength={80}
                                                            text={embedding.properties.original_content}
                                                        />
                                                    </CardContent>
                                                </CardHeader>
                                            </Card>
                                        );
                                    },
                                )
                            ) : (
                                <small>No embeddings found.</small>
                            )}
                        </CardContent>
                    </Card>
                    <UsedByAgents ids={data.agents.map(agent => agent.id)} />
                    <Card className="border-0 border-t-2 rounded-none">
                        <CardHeader>
                            <CardTitle className="text-lg">Embedding jobs</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <RecentJobs
                                type="embedder"
                                statusses={[
                                    JOB_STATUS.completed,
                                    JOB_STATUS.active,
                                    JOB_STATUS.waiting,
                                    JOB_STATUS.delayed,
                                    JOB_STATUS.failed,
                                    JOB_STATUS.paused,
                                    JOB_STATUS.stuck
                                ].join(",")}
                            />
                        </CardContent>
                    </Card> */}
                </div>
            ) : (
                <div className="p-8 text-center text-muted-foreground">
                    No item selected
                </div>
            )}
        </div>
    );
}

const UsedByAgents = ({ ids }: { ids: string[] }) => {

    if (!ids) {
        return <p>No agents using this context.</p>;
    }

    const query = useApolloQuery(GET_AGENTS, {
        variables: {
            page: 1,
            limit: 10,
            filters: {
                _operators: {
                    backend: {
                        in: ids
                    }
                }
            }
        }
    });

    if (query.loading) {
        return <Card className="border-0 border-t-2 rounded-none"><CardContent className="grid gap-4">
            <Skeleton className="h-10 w-100 mt-5" />
            <Skeleton className="h-10 w-100 mt-0" />
            <Skeleton className="h-10 w-100 mt-0" />
        </CardContent></Card>;
    }

    if (query.error) {
        return <Card className="border-0 border-t-2 rounded-none"><CardContent className="grid gap-4"><p>Error: {query.error.message}</p></CardContent></Card>;
    }

    const agents = query.data?.agentPagination.items;
    if (!agents) {
        return <Card className="border-0 border-t-2 rounded-none"><CardContent className="grid gap-4"><p>No agents found.</p></CardContent></Card>;
    }

    return (
        <Card className="border-0 border-t-2 rounded-none">
            <CardHeader>
                <CardTitle className="text-lg">Used by agents ({agents.length})</CardTitle>
            </CardHeader>
            {agents.length > 0 ? (
                <CardContent className="grid gap-4">
                    <div>
                        {query.data?.agentPagination.items.map((agent) => (
                            <Card className="border-0 p-0" key={agent.id}>
                                <CardHeader className="p-3">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <Bot className="size-4" />
                                            <Link href={`/agents/edit/${agent.id}`} className="text-primary hover:underline">
                                                <CardTitle className="text-sm">{agent.name}</CardTitle>
                                            </Link>
                                        </div>
                                        <CardDescription className="text-xs">{agent.description}</CardDescription>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            ) : (
                <CardContent className="grid gap-4">
                    <p>No agents using this context.</p>
                </CardContent>
            )}
        </Card>
    );
}