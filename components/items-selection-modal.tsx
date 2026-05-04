import { Context } from "@/types/models/context";
import { useContexts } from "@/hooks/contexts";
import { useState, useEffect } from "react"
import { Brain, Folder, FolderOpen, File, ChevronRight, X, Check, Plus, Loader2, LayersPlus, FilePlusCorner } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQuery, useMutation } from "@apollo/client";
import {
    Command,
    CommandInput,
} from "@/components/ui/command"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Item } from "@/types/models/item";
import { GET_ITEMS, PAGINATION_POSTFIX, CREATE_ITEM } from "@/queries/queries";
import { Loading } from "./ui/loading";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ItemFormFields } from "@/components/item-form-fields";

type SelectedItem = {
    item: Item;
    context: Context;
};

export const ItemsSelectionModal = ({ onConfirm, onSelectContext, buttonText, className }: {
    onConfirm: (data: {
        item: Item,
        context: Context
    }[]) => void
    onSelectContext?: (context: Context) => void | Promise<void>
    buttonText?: string
    tooltipText?: string
    className?: string
}) => {
    const { data, loading } = useContexts();
    const [selectedContext, setSelectedContext] = useState<Context | undefined>(undefined);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [open, setOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const reset = () => {
        setSelectedItems([]);
        setSelectedContext(undefined);
    };

    const toggleItemSelection = (item: Item, context: Context) => {
        setSelectedItems(prev => {
            const exists = prev.find(s => s.item.id === item.id);
            if (exists) {
                return prev.filter(s => s.item.id !== item.id);
            }
            return [...prev, { item, context }];
        });
    };

    const removeSelectedItem = (itemId?: string) => {
        if (!itemId) return;
        setSelectedItems(prev => prev.filter(s => s.item.id !== itemId));
    };

    const isItemSelected = (itemId: string) => {
        return selectedItems.some(s => s.item.id === itemId);
    };

    const handleConfirm = () => {
        if (selectedItems.length > 0) {
            onConfirm(selectedItems);
            setOpen(false);
            reset();
        }
    };

    const handleSelectAll = () => {
        if (!selectedContext || !onSelectContext) return;
        onSelectContext(selectedContext);
        setOpen(false);
        reset();
    };

    const handleCancel = () => {
        setOpen(false);
        reset();
    };

    return (
        <Dialog open={open} onOpenChange={(value) => {
            if (!value) {
                handleCancel();
            } else {
                setOpen(value);
            }
        }}>
            <DialogTrigger asChild>
                <Button className={`${className}`} variant="outline" type="button">
                    <Brain className={`h-4 w-4 ${buttonText ? "mr-2" : ""}`} />
                    {buttonText}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[1200px] h-[700px] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4">
                    <DialogTitle>Browse Items</DialogTitle>
                    <DialogDescription>
                        Select items from folders and add them to your selection
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden border-t min-h-0">
                    {/* Left sidebar - Folder tree */}
                    <div className="flex-shrink-0 flex-grow-0 basis-64 border-r bg-muted/10 flex flex-col min-w-0">
                        <div className="h-full">
                            <div className="p-4 space-y-1">
                                <div className="text-xs font-semibold text-muted-foreground px-3 py-2">
                                    FOLDERS
                                </div>
                                {loading ? (
                                    <div className="px-3 py-2">
                                        <Loading />
                                    </div>
                                ) : (
                                    data?.contexts?.items.map((context: Context) => (
                                        <button
                                            key={context.id}
                                            onClick={() => setSelectedContext(context)}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                                                "hover:bg-accent hover:text-accent-foreground",
                                                selectedContext?.id === context.id
                                                    ? "bg-accent text-accent-foreground font-medium"
                                                    : "text-foreground"
                                            )}
                                        >
                                            {selectedContext?.id === context.id ? (
                                                <FolderOpen className="h-4 w-4 shrink-0" />
                                            ) : (
                                                <Folder className="h-4 w-4 shrink-0" />
                                            )}
                                            <span className="truncate">{context.name}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Middle panel - Items list */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {selectedContext ? (
                            <>
                                {/* Breadcrumb */}
                                <div className="px-6 py-3 border-b bg-muted/5 flex-shrink-0">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Folder className="h-4 w-4" />
                                            <ChevronRight className="h-3 w-3" />
                                            <span className="font-medium text-foreground">{selectedContext.name}</span>
                                        </div>
                                        <NewItemDialog context={selectedContext} onItemCreated={(newItem) => {
                                            toggleItemSelection(newItem, selectedContext);
                                            setRefreshTrigger(prev => prev + 1);
                                        }} onSelectAll={onSelectContext ? handleSelectAll : undefined} />
                                    </div>
                                </div>

                                {/* Items list */}
                                <div className="flex-1 overflow-hidden min-h-0">
                                    <ItemsList
                                        context={selectedContext}
                                        onToggleItem={toggleItemSelection}
                                        isItemSelected={isItemSelected}
                                        refreshTrigger={refreshTrigger}
                                        key={selectedContext.id}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                <div className="text-center space-y-2">
                                    <Folder className="h-12 w-12 mx-auto opacity-20" />
                                    <p className="text-sm">Select a folder to view its items</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right sidebar - Selected items */}
                    <div className="flex-shrink-0 flex-grow-0 basis-80 border-l bg-muted/5 flex flex-col min-w-0">
                        <div className="px-4 py-3 border-b flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold">Selected Items</h3>
                                <Badge variant="secondary">{selectedItems.length}</Badge>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 min-w-0">
                            {selectedItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                                    <File className="h-10 w-10 mb-2 opacity-20" />
                                    <p className="text-xs text-center">No items selected yet</p>
                                    <p className="text-xs text-center mt-1">Click items to add them</p>
                                </div>
                            ) : (
                                <div className="p-3 space-y-2">
                                    {selectedItems.map(({ item, context }) => (
                                        <div
                                            key={item.id}
                                            className="flex items-start gap-2 p-2 rounded-md bg-background border group hover:border-foreground/20 transition-colors"
                                        >
                                            <File className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{item.name}</p>
                                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                    <Folder className="h-3 w-3" />
                                                    {context.name}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => removeSelectedItem(item.id)}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t">
                    <Button variant="outline" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={selectedItems.length === 0}>
                        <Check className="h-4 w-4 mr-2" />
                        Add {selectedItems.length > 0 && `(${selectedItems.length})`} Item{selectedItems.length !== 1 ? 's' : ''}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const ItemsList = ({
    context,
    onToggleItem,
    isItemSelected,
    refreshTrigger
}: {
    context: Context;
    onToggleItem: (item: Item, context: Context) => void;
    isItemSelected: (itemId: string) => boolean;
    refreshTrigger?: number;
}) => {
    const [search, setSearch] = useState<string>("")
    const fields = context.fields?.map(field => {
        if (field.type === "file" && !field.name.endsWith("_s3key")) {
            return field.name + "_s3key";
        }
        return field.name;
    }) || [];

    let { loading, data, previousData: prev, refetch } = useQuery<{
        [key: string]: {
            pageInfo: {
                pageCount: number;
                itemCount: number;
                currentPage: number;
                hasPreviousPage: boolean;
                hasNextPage: boolean;
            };
            items: Item[];
        }
    }>(GET_ITEMS(context.id, fields), {
        fetchPolicy: "no-cache",
        nextFetchPolicy: "network-only",
        skip: !context.id,
        variables: {
            context: context.id,
            page: 1,
            limit: 50,
            sort: {
                field: "updatedAt",
                direction: "DESC",
            },
            filters: {
                archived: {
                    ne: true
                },
                ...(search ? { name: { contains: search } } : {}),
            },
        },
    });

    useEffect(() => {
        if (refreshTrigger) {
            refetch();
        }
    }, [refreshTrigger, refetch]);

    const items = (data || prev)?.[context.id + PAGINATION_POSTFIX]?.items || [];

    return (
        <>
            <div className="px-6 py-3">
                <Command className="border-0 shadow-none">
                    <CommandInput
                        onValueChange={(data) => setSearch(data)}
                        placeholder="Search items in this context..."
                    />
                </Command>
            </div>
            <div className="flex flex-col h-full overflow-y-auto">

                <div className="flex-1">
                    <div className="p-4">
                        {loading && items.length === 0 ? (
                            <div className="flex justify-center py-8">
                                <Loading />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <File className="h-12 w-12 mb-3 opacity-20" />
                                <p className="text-sm">No items in this folder</p>
                                {search && <p className="text-xs mt-1">Try a different search</p>}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {items.map((item: Item) => {
                                    const selected = isItemSelected(item.id ?? "");
                                    const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
                                    const description = item.description || "";
                                    const descriptionPreview = description.length > 100
                                        ? description.substring(0, 100) + "..."
                                        : description;

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => onToggleItem(item, context)}
                                            className={cn(
                                                "w-full flex items-start gap-3 px-4 py-3 rounded-md text-sm transition-colors",
                                                "border text-left relative",
                                                selected
                                                    ? "bg-primary/10 border-primary text-primary"
                                                    : "hover:bg-accent hover:text-accent-foreground border-transparent hover:border-border"
                                            )}
                                        >
                                            <div className={cn(
                                                "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors mt-0.5",
                                                selected
                                                    ? "bg-primary border-primary"
                                                    : "border-muted-foreground/30"
                                            )}>
                                                {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                                            </div>
                                            <File className={cn(
                                                "h-4 w-4 shrink-0 mt-0.5",
                                                selected ? "text-primary" : "text-muted-foreground"
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <div className={cn(
                                                    "font-medium text-pretty",
                                                    selected && "text-primary"
                                                )}>
                                                    {item.name}
                                                </div>
                                                {descriptionPreview && (
                                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                        {descriptionPreview}
                                                    </div>
                                                )}
                                                {
                                                    item.external_id && (
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            {item.external_id}
                                                        </div>
                                                    )
                                                }
                                                {updatedAt && (
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Updated {updatedAt.toLocaleDateString()} at {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

const LoadingStates = ({ hasProcessor }: { hasProcessor: boolean }) => {
    const states = hasProcessor
        ? ["Creating item...", "Processing fields...", "Preparing for AI...", "Almost done..."]
        : ["Creating item...", "Saving data...", "Almost done..."];

    const [currentStateIndex, setCurrentStateIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStateIndex((prev) => (prev + 1) % states.length);
        }, 1500);

        return () => clearInterval(interval);
    }, [states.length]);

    return (
        <DialogContent
            className="sm:max-w-md border-none shadow-2xl bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
        >
            <div className="flex flex-col items-center space-y-6 py-6">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <div className="space-y-3 text-center">
                    <h3 className="text-xl font-semibold">{states[currentStateIndex]}</h3>
                    <p className="text-sm text-muted-foreground px-4">
                        {hasProcessor
                            ? "Your item is being processed. This may take a moment."
                            : "Saving your new item..."}
                    </p>
                </div>
                <div className="flex space-x-2 pt-2">
                    {states.map((_, index) => (
                        <div
                            key={index}
                            className={cn(
                                "h-2 rounded-full transition-all duration-300",
                                index === currentStateIndex
                                    ? "bg-primary w-8"
                                    : "bg-muted-foreground/30 w-2"
                            )}
                        />
                    ))}
                </div>
            </div>
        </DialogContent>
    );
};

export const NewItemDialog = ({ context, onItemCreated, fieldsToReturn, onSelectAll }: {
    context: Context;
    onItemCreated: (item: Item) => void;
    fieldsToReturn?: string[];
    onSelectAll?: () => void;
}) => {
    const [open, setOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Item>>({
        name: "",
        description: "",
        tags: [],
        external_id: "",
    });

    const [createItemMutation, { loading }] = useMutation(CREATE_ITEM(context.id, fieldsToReturn || []), {
        onCompleted: (data) => {
            const createdItem = data[`${context.id}_itemsCreateOne`]?.item;
            if (createdItem) {
                toast.success("Item created", {
                    description: "Item created successfully and added to your selection.",
                });
                onItemCreated(createdItem);
                setOpen(false);
                setFormData({
                    name: "",
                    description: "",
                    tags: [],
                    external_id: "",
                });
            }
        },
        onError: (error) => {
            toast.error("Error creating item", {
                description: error.message,
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        console.log("formData", formData);

        if (!formData.name?.trim()) {
            toast.error("Required fields missing", {
                description: "Please fill in name and description.",
            });
            return;
        }

        // Build input with custom fields
        const input: any = {
            name: formData.name,
            description: formData.description,
            tags: formData.tags?.join(",") || undefined,
            external_id: formData.external_id || undefined,
        };

        // Add custom fields
        context.fields?.forEach(field => {
            if (field.editable !== false && formData[field.name] !== undefined && formData[field.name] !== null && formData[field.name] !== "") {
                input[field.name] = formData[field.name];
            }
        });

        createItemMutation({
            variables: {
                input,
            },
        });
    };

    return (
        <>
            <Dialog open={open} onOpenChange={(newOpen) => {
                if (!loading) {
                    setOpen(newOpen);
                }
            }}>
                <div className="flex items-center gap-2">
                    {onSelectAll && (
                        <Button onClick={onSelectAll} variant="outline" size="sm">
                            <LayersPlus className="h-4 w-4 mr-2" />
                            Select all
                        </Button>
                    )}
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <FilePlusCorner className="h-4 w-4 mr-2" />
                            New Item
                        </Button>
                    </DialogTrigger>
                </div>
                {loading ? (
                    <LoadingStates hasProcessor={!!context.processor} />
                ) : (
                    <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0">
                        <DialogHeader className="px-6 pt-6 pb-4">
                            <DialogTitle>Create New Item</DialogTitle>
                            <DialogDescription>
                                Add a new item to <span className="font-medium">{context.name}</span>
                            </DialogDescription>
                        </DialogHeader>
                        <div className="px-6 h-full overflow-y-auto" id="new-item-form">
                            <ItemFormFields
                                context={context}
                                newItem={true}
                                data={formData}
                                editing={true}
                                onDataChange={setFormData}
                            />
                        </div>
                        <DialogFooter className="px-6 py-4 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSubmit} disabled={loading}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create & Add
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </>
    );
};