import { Context } from "@/types/models/context";
import { useContexts } from "@/hooks/contexts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect, useMemo } from "react"
import { ArrowLeft, Brain, Folder, FolderOpen, File, ChevronRight, X, Check, Plus, Loader2, LayersPlus, FilePlusCorner, Bookmark, Search, Database, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQuery, useMutation, useApolloClient } from "@apollo/client";
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
import { GET_ITEMS, PAGINATION_POSTFIX, CREATE_ITEM, GET_CONTEXT_PRESETS, INCREMENT_PRESET_USAGE } from "@/queries/queries";
import { Loading } from "@/components/primitives/loading";
import { LoadingStates } from "@/components/loading-states";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ItemFormFields } from "@/components/item-form-fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { parsePresetItemsForDisplay, validatePresetItems, type PresetValidationResult } from "@/lib/validate-preset-items";
import { Alert, AlertDescription } from "@/components/ui/alert";

type SelectedItem = {
    item: Item;
    context: Context;
};

interface ContextPreset {
    id: string
    name: string
    description?: string
    preset_items: string[]
    tags?: string[]
    usage_count: number
    created_by: number
    createdAt: string
}

export const ItemsSelectionModal = ({
    onConfirm,
    onSelectContext,
    onApplyPreset,
    open: controlledOpen,
    onOpenChange,
    note,
    buttonText,
    buttonType,
    buttonVariant,
    buttonSize,
    buttonClassName,
    iconClassName
}: {
    onConfirm: (data: {
        item: Item,
        context: Context
    }[]) => void
    onSelectContext?: (context: Context) => void | Promise<void>
    onApplyPreset?: (items: string[], preset: ContextPreset) => void | Promise<void>
    /** Optional controlled mode (additive): when `open` is provided the
     *  built-in trigger button is not rendered and open state is owned by
     *  the caller (used by the chat composer's AttachMenu). Existing
     *  trigger-based consumers (project-details) are unaffected. */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /** Optional one-line note rendered under the dialog description (e.g.
     *  the chat composer's managed-context notice, chat.md item 72). */
    note?: string
    buttonText?: string
    tooltipText?: string
    buttonType?: "button" | "submit" | "reset"
    buttonVariant?: "default" | "outline" | "ghost" | "link"
    buttonSize?: "default" | "sm" | "lg" | "icon"
    buttonClassName?: string
    iconClassName?: string
}) => {
    const apolloClient = useApolloClient();
    const isMobile = useIsMobile();
    const { data, loading } = useContexts();
    const [selectedContext, setSelectedContext] = useState<Context | undefined>(undefined);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = (value: boolean) => {
        if (isControlled) {
            onOpenChange?.(value);
        } else {
            setInternalOpen(value);
        }
    };
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [activeTab, setActiveTab] = useState<"browse" | "presets">("browse");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPreset, setSelectedPreset] = useState<ContextPreset | null>(null);
    const [validationResult, setValidationResult] = useState<PresetValidationResult | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    // Preset queries
    const { data: presetsData, loading: presetsLoading } = useQuery(GET_CONTEXT_PRESETS, {
        variables: {
            page: 1,
            limit: 100,
            sort: { field: "updatedAt", direction: "DESC" }
        },
        skip: !open || activeTab !== "presets",
    });

    const [incrementUsage] = useMutation(INCREMENT_PRESET_USAGE);

    const presets: ContextPreset[] = presetsData?.context_presetsPagination?.items || [];

    // Filter presets by search query
    const filteredPresets = useMemo(() => {
        if (!searchQuery.trim()) return presets;
        const query = searchQuery.toLowerCase();
        return presets.filter(preset =>
            preset.name.toLowerCase().includes(query) ||
            preset.description?.toLowerCase().includes(query) ||
            preset.tags?.some(tag => tag.toLowerCase().includes(query))
        );
    }, [presets, searchQuery]);

    const reset = () => {
        setSelectedItems([]);
        setSelectedContext(undefined);
        setActiveTab("browse");
        setSearchQuery("");
        setSelectedPreset(null);
        setValidationResult(null);
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

    // Validate selected preset
    const handleSelectPreset = async (preset: ContextPreset) => {
        setSelectedPreset(preset);
        setIsValidating(true);
        setValidationResult(null);

        try {
            const result = await validatePresetItems(preset.preset_items, apolloClient);
            setValidationResult(result);
        } catch (error) {
            console.error('Error validating preset:', error);
            toast.error("Validation error", {
                description: "Failed to validate preset items. Please try again.",
            });
        } finally {
            setIsValidating(false);
        }
    };

    const handleApplyPreset = async () => {
        if (!selectedPreset || !validationResult || !onApplyPreset) return;

        try {
            await incrementUsage({
                variables: {
                    id: selectedPreset.id,
                    usage_count: selectedPreset.usage_count + 1
                }
            });

            await onApplyPreset(validationResult.validItems, selectedPreset);

            toast.success("Preset applied", {
                description: validationResult.isValid
                    ? `${validationResult.validCount} items added successfully.`
                    : `${validationResult.validCount} items added. ${validationResult.invalidItems.length} invalid items were skipped.`
            });

            setOpen(false);
            reset();
        } catch (error) {
            console.error('Error applying preset:', error);
            toast.error("Error applying preset", {
                description: error instanceof Error ? error.message : "Failed to apply preset. Please try again.",
            });
        }
    };

    const handleConfirm = () => {
        if (activeTab === "presets") {
            handleApplyPreset();
        } else if (selectedItems.length > 0) {
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
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button type={buttonType} variant={buttonVariant} size={buttonSize} className={buttonClassName}>
                        <Brain className={`${iconClassName || "h-4 w-4"} ${buttonText ? "mr-2" : ""}`} />
                        {buttonText}
                    </Button>
                </DialogTrigger>
            )}
            {/* T5: full-screen below sm, bounded by dvh above (no fixed 1200×700). */}
            <DialogContent className="flex h-dvh max-h-dvh flex-col p-0 sm:h-[min(700px,85dvh)] sm:max-h-[85dvh] sm:max-w-[90vw] xl:max-w-6xl">
                <DialogHeader className="px-6 pt-6 pb-4">
                    <DialogTitle>Add Context & Items</DialogTitle>
                    <DialogDescription>
                        Browse contexts and items, or load a saved preset
                    </DialogDescription>
                    {note && (
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                            <span className="min-w-0">{note}</span>
                        </p>
                    )}
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "browse" | "presets")} className="flex flex-col flex-1 overflow-hidden">
                    <div className="px-6 border-b">
                        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-to-lg">
                            <TabsTrigger value="browse">Browse</TabsTrigger>
                            <TabsTrigger value="presets">Presets</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="browse" className="flex-1 overflow-hidden m-0">
                        <div className="flex h-full overflow-hidden min-h-0">
                            {/* Left sidebar - Folder tree. Below md this is step 1 of the
                                stepped flow (T5): full width, hidden once a context is open. */}
                            {(!isMobile || !selectedContext) && (
                                <div className={cn(
                                    isMobile
                                        ? "flex w-full flex-col min-w-0 overflow-y-auto"
                                        : "flex-shrink-0 flex-grow-0 basis-64 border-r bg-muted/10 flex flex-col min-w-0"
                                )}>
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
                                                            "min-h-[44px] md:min-h-0",
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
                                                        {isMobile && <ChevronRight className="h-4 w-4 ml-auto shrink-0 text-muted-foreground" />}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Middle panel - Items list. Below md this is step 2 with a back affordance. */}
                            {(!isMobile || selectedContext) && (
                            <div className="flex-1 flex flex-col min-w-0">
                                {selectedContext ? (
                                    <>
                                        {/* Breadcrumb */}
                                        <div className="px-4 md:px-6 py-2 md:py-3 border-b bg-muted/5 flex-shrink-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                                                    {isMobile && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedContext(undefined)}
                                                            aria-label="Back"
                                                            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                        >
                                                            <ArrowLeft className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <Folder className="h-4 w-4 shrink-0" />
                                                    <ChevronRight className="h-3 w-3 shrink-0" />
                                                    <span className="font-medium text-foreground truncate">{selectedContext.name}</span>
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
                            )}

                            {/* Right sidebar - Selected items (desktop only; the footer
                                count carries the selection below md, T5 bottom-bar) */}
                            <div className="flex-shrink-0 flex-grow-0 basis-80 border-l bg-muted/5 hidden md:flex flex-col min-w-0">
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
                                                        aria-label={`Remove ${item.name}`}
                                                        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
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
                    </TabsContent>

                    <TabsContent value="presets" className="flex-1 overflow-hidden m-0">
                        <div className="flex h-full overflow-hidden min-h-0">
                            {/* Preset list. Below md this is step 1 (T5); selecting a preset
                                moves to the preview step. */}
                            {(!isMobile || !selectedPreset) && (
                            <div className="flex-1 flex flex-col md:border-r">
                                {/* Search */}
                                <div className="px-4 py-3 border-b flex-shrink-0">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search presets..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                </div>

                                {/* List */}
                                <div className="flex-1 overflow-y-auto">
                                    {presetsLoading ? (
                                        <div className="flex items-center justify-center h-full">
                                            <Loading />
                                        </div>
                                    ) : filteredPresets.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                                            <Bookmark className="h-12 w-12 mb-2 opacity-20" />
                                            <p className="text-sm text-center">
                                                {searchQuery ? "No presets match your search" : "No presets available"}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="p-3 space-y-2">
                                            {filteredPresets.map((preset) => {
                                                const stats = parsePresetItemsForDisplay(preset.preset_items);
                                                const isSelected = selectedPreset?.id === preset.id;

                                                return (
                                                    <button
                                                        key={preset.id}
                                                        onClick={() => handleSelectPreset(preset)}
                                                        className={cn(
                                                            "w-full text-left p-3 rounded-lg border transition-all",
                                                            "hover:border-primary/50 hover:bg-accent/50",
                                                            isSelected && "border-primary bg-accent"
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                            <h4 className="font-medium text-sm line-clamp-1">{preset.name}</h4>
                                                            {isSelected && (
                                                                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                                            )}
                                                        </div>

                                                        {preset.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                                                {preset.description}
                                                            </p>
                                                        )}

                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <Database className="h-3 w-3" />
                                                            <span>
                                                                {stats.contextCount} {stats.contextCount === 1 ? 'context' : 'contexts'}
                                                            </span>
                                                            {stats.itemCount > 0 && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>{stats.itemCount} {stats.itemCount === 1 ? 'item' : 'items'}</span>
                                                                </>
                                                            )}
                                                        </div>

                                                        {preset.tags && preset.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                {preset.tags.slice(0, 3).map((tag) => (
                                                                    <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                                                                        {tag}
                                                                    </Badge>
                                                                ))}
                                                                {preset.tags.length > 3 && (
                                                                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                                                        +{preset.tags.length - 3}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            )}

                            {/* Preview. Below md this is step 2 with a back affordance. */}
                            {(!isMobile || selectedPreset) && (
                            <div className={cn(
                                isMobile
                                    ? "flex w-full flex-col min-w-0 bg-muted/5"
                                    : "flex-shrink-0 flex-grow-0 basis-80 bg-muted/5 flex flex-col"
                            )}>
                                <div className="px-4 py-2 md:py-3 border-b flex-shrink-0 flex items-center gap-2">
                                    {isMobile && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPreset(null);
                                                setValidationResult(null);
                                            }}
                                            aria-label="Back"
                                            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </button>
                                    )}
                                    <h3 className="text-sm font-semibold">Preview</h3>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4">
                                    {!selectedPreset ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                            <Bookmark className="h-10 w-10 mb-2 opacity-20" />
                                            <p className="text-xs text-center">Select a preset to preview</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-sm font-semibold mb-2">{selectedPreset.name}</h4>
                                                {selectedPreset.description && (
                                                    <p className="text-xs text-muted-foreground">{selectedPreset.description}</p>
                                                )}
                                            </div>

                                            {isValidating ? (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>Validating items...</span>
                                                </div>
                                            ) : validationResult ? (
                                                <div className="space-y-3">
                                                    {!validationResult.isValid && (
                                                        <Alert variant="destructive">
                                                            <AlertCircle className="h-4 w-4" />
                                                            <AlertDescription className="text-xs">
                                                                {validationResult.invalidItems.length} {validationResult.invalidItems.length === 1 ? 'item' : 'items'} no longer exist and will be skipped.
                                                            </AlertDescription>
                                                        </Alert>
                                                    )}

                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-muted-foreground">Total items</span>
                                                            <Badge variant="secondary">{validationResult.totalCount}</Badge>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-muted-foreground">Valid items</span>
                                                            <Badge variant="default" className="bg-green-500">
                                                                {validationResult.validCount}
                                                            </Badge>
                                                        </div>
                                                        {validationResult.invalidItems.length > 0 && (
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-muted-foreground">Invalid items</span>
                                                                <Badge variant="destructive">
                                                                    {validationResult.invalidItems.length}
                                                                </Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="px-4 md:px-6 py-3 md:py-4 border-t gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <Button variant="outline" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={
                            activeTab === "browse"
                                ? selectedItems.length === 0
                                : !selectedPreset || isValidating || !validationResult || validationResult.validCount === 0
                        }
                    >
                        <Check className="h-4 w-4 mr-2" />
                        {activeTab === "browse" ? (
                            <>Add {selectedItems.length > 0 && `(${selectedItems.length})`} Item{selectedItems.length !== 1 ? 's' : ''}</>
                        ) : (
                            <>Add {validationResult?.validCount ? `(${validationResult.validCount})` : ''} Items</>
                        )}
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
                    <DialogContent
                        className="sm:max-w-md border-none shadow-2xl bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95"
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onEscapeKeyDown={(e) => e.preventDefault()}
                        onInteractOutside={(e) => e.preventDefault()}
                    >
                        <LoadingStates variant={context.processor ? "create-with-processor" : "create"} />
                    </DialogContent>
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