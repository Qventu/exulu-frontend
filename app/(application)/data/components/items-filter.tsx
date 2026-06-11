"use client"

import { useQuery } from "@apollo/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { GET_ITEMS } from "@/queries/queries";
import { Separator } from "@/components/ui/separator";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export interface ItemFilters {
    name?: string;
    external_id?: string;
    createdAt_gte?: string;
    createdAt_lte?: string;
    updatedAt_gte?: string;
    updatedAt_lte?: string;
    embeddings_updated_at_gte?: string;
    embeddings_updated_at_lte?: string;
    last_processed_at_gte?: string;
    last_processed_at_lte?: string;
    chunks_count_gte?: number;
    chunks_count_lte?: number;
}

export const ItemsFilter = (props: {
    ctaLabel: string;
    cancelLabel: string;
    showPreview?: boolean;
    onCancel: () => void;
    onClear?: () => void;
    onConfirm: (graphqlFilters: any[], rawFilters: ItemFilters, limit?: number) => Promise<void>;
    context: string;
    initialFilters?: ItemFilters;
    initialLimit?: number;
}) => {

    const [loading, setLoading] = useState(false);

    const formatDate = (dateString?: string) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const [filters, setFilters] = useState<ItemFilters>(props.initialFilters || {});
    const [limit, setLimit] = useState(props.initialLimit || 10);

    // Convert our filters to GraphQL format
    const buildGraphQLFilters = (filters: ItemFilters): any[] => {

        const graphqlFilters: any[] = [];

        if (filters.name) {
            graphqlFilters.push({ name: { contains: filters.name } });
        }
        if (filters.external_id) {
            graphqlFilters.push({ external_id: { contains: filters.external_id } });
        }
        if (filters.createdAt_gte) {
            graphqlFilters.push({ createdAt: { gte: filters.createdAt_gte } });
        }
        if (filters.createdAt_lte) {
            graphqlFilters.push({ createdAt: { lte: filters.createdAt_lte } });
        }
        if (filters.updatedAt_gte) {
            graphqlFilters.push({ updatedAt: { gte: filters.updatedAt_gte } });
        }
        if (filters.updatedAt_lte) {
            graphqlFilters.push({ updatedAt: { lte: filters.updatedAt_lte } });
        }
        if (filters.embeddings_updated_at_gte) {
            graphqlFilters.push({ embeddings_updated_at: { gte: filters.embeddings_updated_at_gte } });
        }
        if (filters.embeddings_updated_at_lte) {
            graphqlFilters.push({ embeddings_updated_at: { lte: filters.embeddings_updated_at_lte } });
        }
        if (filters.last_processed_at_gte) {
            graphqlFilters.push({ last_processed_at: { gte: filters.last_processed_at_gte } });
        }
        if (filters.last_processed_at_lte) {
            graphqlFilters.push({ last_processed_at: { lte: filters.last_processed_at_lte } });
        }
        if (filters.chunks_count_gte !== undefined) {
            graphqlFilters.push({ chunks_count: { gte: filters.chunks_count_gte } });
        }
        if (filters.chunks_count_lte !== undefined) {
            graphqlFilters.push({ chunks_count: { lte: filters.chunks_count_lte } });
        }

        return graphqlFilters;
    };

    // Query for preview items
    const { data: previewData, loading: previewLoading, refetch: refetchPreview } = useQuery(
        GET_ITEMS(props.context, ["id", "name", "external_id", "chunks_count", "createdAt", "updatedAt", "embeddings_updated_at", "last_processed_at"]),
        {
            skip: !props.showPreview,
            variables: {
                page: 1,
                limit: 3,
                filters: buildGraphQLFilters(filters),
                sort: {
                    field: "updatedAt",
                    direction: "DESC"
                }
            }
        }
    );

    const previewItems = previewData?.[`${props.context}_itemsPagination`]?.items || [];
    const totalCount = previewData?.[`${props.context}_itemsPagination`]?.pageInfo?.itemCount || 0;

    // Refetch preview when filters change
    useEffect(() => {
        if (props.showPreview) {
            refetchPreview({
                page: 1,
                limit: 3,
                filters: buildGraphQLFilters(filters),
                sort: {
                    field: "updatedAt",
                    direction: "DESC"
                }
            });
        }
    }, [filters, props.context, refetchPreview]);

    const onConfirm = async (filters: ItemFilters, limit?: number) => {
        try {
            setLoading(true);
            const graphqlFilters: any[] = buildGraphQLFilters(filters);
            await props.onConfirm(graphqlFilters, filters, limit);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    }

    return (
        <>
            <div className={`grid grid-cols-${props.showPreview ? '2' : '1'} gap-6 overflow-auto flex-1`}>
                {/* Left side - Filters */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Filters</h3>

                    <div className="space-y-2">
                        <Label htmlFor="name">Item Name (partial match)</Label>
                        <Input
                            id="name"
                            value={filters.name || ''}
                            onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                            placeholder="Enter name..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="external_id">External ID (partial match)</Label>
                        <Input
                            id="external_id"
                            value={filters.external_id || ''}
                            onChange={(e) => setFilters({ ...filters, external_id: e.target.value })}
                            placeholder="Enter external ID..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Created Date</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                type="datetime-local"
                                value={filters.createdAt_gte || ''}
                                onChange={(e) => setFilters({ ...filters, createdAt_gte: e.target.value })}
                                placeholder="From"
                            />
                            <Input
                                type="datetime-local"
                                value={filters.createdAt_lte || ''}
                                onChange={(e) => setFilters({ ...filters, createdAt_lte: e.target.value })}
                                placeholder="To"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Updated Date</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                type="datetime-local"
                                value={filters.updatedAt_gte || ''}
                                onChange={(e) => setFilters({ ...filters, updatedAt_gte: e.target.value })}
                                placeholder="From"
                            />
                            <Input
                                type="datetime-local"
                                value={filters.updatedAt_lte || ''}
                                onChange={(e) => setFilters({ ...filters, updatedAt_lte: e.target.value })}
                                placeholder="To"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Embeddings Updated Date</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                type="datetime-local"
                                value={filters.embeddings_updated_at_gte || ''}
                                onChange={(e) => setFilters({ ...filters, embeddings_updated_at_gte: e.target.value })}
                                placeholder="From"
                            />
                            <Input
                                type="datetime-local"
                                value={filters.embeddings_updated_at_lte || ''}
                                onChange={(e) => setFilters({ ...filters, embeddings_updated_at_lte: e.target.value })}
                                placeholder="To"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Last Processed Date</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                type="datetime-local"
                                value={filters.last_processed_at_gte || ''}
                                onChange={(e) => setFilters({ ...filters, last_processed_at_gte: e.target.value })}
                                placeholder="From"
                            />
                            <Input
                                type="datetime-local"
                                value={filters.last_processed_at_lte || ''}
                                onChange={(e) => setFilters({ ...filters, last_processed_at_lte: e.target.value })}
                                placeholder="To"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Chunks Count</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                type="number"
                                value={filters.chunks_count_gte ?? ''}
                                onChange={(e) => setFilters({ ...filters, chunks_count_gte: e.target.value ? parseInt(e.target.value) : undefined })}
                                placeholder="Min"
                            />
                            <Input
                                type="number"
                                value={filters.chunks_count_lte ?? ''}
                                onChange={(e) => setFilters({ ...filters, chunks_count_lte: e.target.value ? parseInt(e.target.value) : undefined })}
                                placeholder="Max"
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <Label htmlFor="limit">
                            Limit
                            <span className="ml-2 text-xs text-muted-foreground font-normal">
                                Maximum number of items to process
                            </span>
                        </Label>
                        <Input
                            id="limit"
                            value={limit || ''}
                            onChange={(e) => {
                                setLimit(parseInt(e.target.value));
                            }}
                            placeholder="10"
                            type="number"
                            min={1}
                            max={500}
                        />
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (props.onClear) {
                                props.onClear();
                            }
                            setFilters({})
                        }}

                        className="w-full"
                    >
                        Clear Filters
                    </Button>
                </div>

                {/* Right side - Preview */}
                {props.showPreview && (
                    <div className="space-y-4 border-l pl-6 flex flex-col">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Preview</h3>
                            <Badge variant="secondary">
                                {previewLoading ? "Loading..." : `${totalCount} total items`}
                            </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground">
                            First 3 results matching your filters:
                        </p>

                        <div className="flex-1 rounded-md border h-[500px]">
                            {previewLoading ? (
                                <div className="p-4 space-y-3">
                                    <Skeleton className="h-30 w-full rounded-lg" />
                                    <Skeleton className="h-30 w-full rounded-lg" />
                                    <Skeleton className="h-30 w-full rounded-lg" />
                                    <Skeleton className="h-30 w-full rounded-lg" />
                                </div>
                            ) : previewItems.length > 0 ? (
                                <div className="p-4 space-y-3">
                                    {previewItems.map((item: any) => (
                                        <Card key={item.id} className="p-4 hover:shadow-md transition-shadow duration-200 border-l-4 border-l-primary/30">
                                            <div className="space-y-3">
                                                <div className="flex items-start justify-between gap-2 group">
                                                    <Link href={`/data/${props.context}/${item.id}`} target="_blank" className="text-sm flex items-center gap-1 break-all hover:underline">
                                                        {item.name && item.name.length > 90 ? item.name.slice(0, 90) + "..." : item.name}
                                                    </Link>
                                                    <CopyIcon onClick={() => {
                                                        navigator.clipboard.writeText(item.name);
                                                        toast.success("Copied to clipboard", {
                                                            description: `The name: "${item.name}" was copied to your clipboard.`,
                                                        });
                                                    }} className="size-8 cursor-copy hidden group-hover:block" />

                                                    <Badge variant="secondary" className="text-xs shrink-0">
                                                        {item.chunks_count || 0} chunks
                                                    </Badge>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">

                                                    <div className="space-y-1">
                                                        <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Main ID</p>
                                                        <p onClick={() => {
                                                            navigator.clipboard.writeText(item.id);
                                                            toast.success("Copied to clipboard", {
                                                                description: `The main ID: "${item.id}" was copied to your clipboard.`,
                                                            });
                                                        }} className="text-xs font-medium cursor-copy truncate max-w-[80%]">{item.id}</p>
                                                    </div>


                                                    <div className="space-y-1">
                                                        <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">External ID</p>
                                                        <p onClick={() => {
                                                            navigator.clipboard.writeText(item.external_id);
                                                            toast.success("Copied to clipboard", {
                                                                description: `The external ID: "${item.external_id}" was copied to your clipboard.`,
                                                            });
                                                        }} className="text-xs font-medium cursor-copy truncate max-w-[80%]">{item.external_id}</p>
                                                    </div>


                                                    <div className="space-y-1">
                                                        <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Created</p>
                                                        <p className="text-xs font-medium">{formatDate(item.createdAt)}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Updated</p>
                                                        <p className="text-xs font-medium">{formatDate(item.updatedAt)}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Embeddings Updated</p>
                                                        <p className="text-xs font-medium">{formatDate(item.embeddings_updated_at) || "Never"}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Last Processed</p>
                                                        <p className="text-xs font-medium">{formatDate(item.last_processed_at) || "Never"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    No items match the current filters
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {/* Confirm filters */}
            <div className="flex justify-end gap-2 w-full justify-between">
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={loading}
                    onClick={() => props.onCancel()}
                >
                    {props.cancelLabel || "Cancel"}
                </Button>
                <Button
                    variant="default"
                    size="sm"
                    disabled={loading}
                    onClick={() => onConfirm(filters, limit)}
                >
                    {props.ctaLabel} ({limit || totalCount} items)
                </Button>
            </div>
        </>
    )
}