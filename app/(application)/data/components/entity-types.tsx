"use client"

import { useQuery, useMutation } from "@apollo/client";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DotsHorizontalIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Plus, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    BACKFILL_ENTITIES,
    CREATE_ENTITY_TYPE,
    DELETE_ENTITY_TYPE,
    GET_ENTITY_TYPES,
    GET_STALE_ENTITY_COUNT,
    UPDATE_ENTITY_TYPE,
} from "@/queries/queries";

interface EntityTypesProps {
    expand: boolean;
    actions: boolean;
    context: string;
}

type EntityTypeRow = {
    id: string;
    name: string;
    description: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
};

export function ContextEntityTypes(props: EntityTypesProps) {
    const { toast } = useToast();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<EntityTypeRow | null>(null);
    const [formName, setFormName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formActive, setFormActive] = useState(true);

    // Dynamic per-context operations (depend on the context id).
    const backfillMutationDoc = useMemo(() => BACKFILL_ENTITIES(props.context), [props.context]);
    const staleCountQueryDoc = useMemo(() => GET_STALE_ENTITY_COUNT(props.context), [props.context]);

    const { data, loading, error, refetch } = useQuery<{
        entity_type_settingsPagination: { items: EntityTypeRow[] };
    }>(GET_ENTITY_TYPES, {
        variables: { context: props.context },
    });

    const types = data?.entity_type_settingsPagination?.items || [];

    const {
        data: staleData,
        refetch: refetchStale,
    } = useQuery<{ [key: string]: number }>(staleCountQueryDoc);
    const staleCount = staleData?.[`${props.context}_itemsStaleEntityCount`] ?? 0;

    const [createEntityType] = useMutation(CREATE_ENTITY_TYPE, {
        onCompleted: () => {
            refetch();
            refetchStale();
            toast({ title: "Entity type created", description: "The entity type was added." });
        },
        onError: (e) => toast({ title: "Error creating entity type", description: e.message }),
    });

    const [updateEntityType] = useMutation(UPDATE_ENTITY_TYPE, {
        onCompleted: () => {
            refetch();
            refetchStale();
            toast({ title: "Entity type updated", description: "The entity type was updated." });
        },
        onError: (e) => toast({ title: "Error updating entity type", description: e.message }),
    });

    const [deleteEntityType] = useMutation(DELETE_ENTITY_TYPE, {
        onCompleted: () => {
            refetch();
            refetchStale();
            toast({ title: "Entity type deleted", description: "The entity type was removed." });
        },
        onError: (e) => toast({ title: "Error deleting entity type", description: e.message }),
    });

    const [backfillEntities, backfillResult] = useMutation<{
        [key: string]: { processed: number; skipped: number };
    }>(backfillMutationDoc, {
        onCompleted: (output) => {
            const result = output[`${props.context}_itemsBackfillEntities`];
            refetchStale();
            toast({
                title: "Backfill complete",
                description: `Processed ${result?.processed ?? 0} item(s)${
                    result?.skipped ? `, ${result.skipped} skipped (cap reached)` : ""
                }.`,
            });
        },
        onError: (e) => toast({ title: "Error running backfill", description: e.message }),
    });

    const openCreate = () => {
        setEditing(null);
        setFormName("");
        setFormDescription("");
        setFormActive(true);
        setDialogOpen(true);
    };

    const openEdit = (row: EntityTypeRow) => {
        setEditing(row);
        setFormName(row.name);
        setFormDescription(row.description || "");
        setFormActive(row.active);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            toast({ title: "Name required", description: "Please provide an entity type name." });
            return;
        }
        if (editing) {
            await updateEntityType({
                variables: {
                    id: editing.id,
                    name: formName.trim(),
                    description: formDescription,
                    active: formActive,
                },
            });
        } else {
            await createEntityType({
                variables: {
                    name: formName.trim(),
                    description: formDescription,
                    context: props.context,
                    active: formActive,
                },
            });
        }
        setDialogOpen(false);
    };

    const toggleActive = async (row: EntityTypeRow) => {
        await updateEntityType({
            variables: { id: row.id, name: row.name, description: row.description, active: !row.active },
        });
    };

    if (loading) {
        return (
            <div className="p-8">
                <Skeleton className="w-full h-[80px] rounded-md" />
                <Skeleton className="w-full h-[50px] rounded-md mt-3" />
                <Skeleton className="w-full h-[80px] rounded-md mt-3" />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <ExclamationTriangleIcon className="size-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error?.message || "Error loading entity types."}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <Card className="border-0 rounded-none">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Entity Types</CardTitle>
                            <CardDescription>
                                Entity types extracted from documents in this context. These are merged with any
                                types declared in code, and power entity-aware retrieval (precision boost and
                                related-entity exploration).
                            </CardDescription>
                        </div>
                        <Button size="sm" onClick={openCreate}>
                            <Plus className="mr-2 size-4" />
                            Add type
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Backfill prompt — shown when items predate the current type set. */}
                    {staleCount > 0 && (
                        <Alert>
                            <Sparkles className="size-4" />
                            <AlertTitle>Backfill recommended</AlertTitle>
                            <AlertDescription className="flex items-center justify-between gap-4">
                                <span>
                                    {staleCount.toLocaleString()} item(s) were processed before the current entity
                                    types. Run extraction to apply the changes.
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={backfillResult.loading}
                                    onClick={() =>
                                        backfillEntities({ variables: { onlyStale: true } })
                                    }
                                >
                                    {backfillResult.loading ? "Backfilling…" : "Backfill now"}
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {types.length === 0 ? (
                        <div className="text-center text-muted-foreground p-5 border rounded-md">
                            No entity types configured for this context.
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {types.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-medium">{row.name}</TableCell>
                                            <TableCell className="max-w-[400px] text-muted-foreground text-sm">
                                                {row.description || "-"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={row.active ? "default" : "outline"}>
                                                    {row.active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu modal={false}>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            className="flex size-8 p-0 data-[state=open]:bg-muted ml-auto"
                                                        >
                                                            <DotsHorizontalIcon className="size-4" />
                                                            <span className="sr-only">Open menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => openEdit(row)}>
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => toggleActive(row)}>
                                                            {row.active ? "Deactivate" : "Activate"}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                deleteEntityType({ variables: { id: row.id } })
                                                            }
                                                        >
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit entity type" : "Add entity type"}</DialogTitle>
                        <DialogDescription>
                            The name and description guide the extractor on what to identify in documents.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="entity-type-name">Name</Label>
                            <Input
                                id="entity-type-name"
                                placeholder="e.g. Person, Company, Product"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="entity-type-description">Description</Label>
                            <Textarea
                                id="entity-type-description"
                                placeholder="What counts as this entity type?"
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch id="entity-type-active" checked={formActive} onCheckedChange={setFormActive} />
                            <Label htmlFor="entity-type-active">Active</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
