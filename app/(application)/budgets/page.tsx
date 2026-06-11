"use client"

import { useCallback, useContext, useEffect, useState } from "react"
import { useApolloClient } from "@apollo/client"
import { ChevronLeft, ChevronRight, Loader2, Pencil, Save, Search, Wallet } from "lucide-react"
import { UserContext } from "@/app/(application)/authenticated"
import {
    GET_AGENTS_WITH_BUDGETS,
    GET_PROJECTS_WITH_BUDGETS,
    GET_ROLES_WITH_BUDGETS,
    GET_TEAMS_WITH_BUDGETS,
    GET_USERS_WITH_BUDGETS,
} from "@/queries/queries"
import { budgetsApi, type BudgetSettings } from "@/lib/api/budgets"
import { can } from "@/lib/rights"
import {
    BUDGET_DURATIONS,
    BUDGET_ENTITY_TYPES,
    type BudgetDuration,
    type BudgetEntityType,
    type BudgetInfo,
} from "@/lib/budget"
import { BudgetBar } from "@/components/budget-bar"
import { BudgetEditor } from "@/components/budget-editor"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

type Entity = { id: string; label: string; budget: BudgetInfo | null }

const QUERY_MAP: Record<
    BudgetEntityType,
    { query: any; root: string; searchField: string; label: (item: any) => string }
> = {
    user: {
        query: GET_USERS_WITH_BUDGETS,
        root: "usersPagination",
        searchField: "email",
        label: (i) => (i.name || [i.firstname, i.lastname].filter(Boolean).join(" ") || i.email) /* + "(" + i.type + ")" */,
    },
    role: { query: GET_ROLES_WITH_BUDGETS, root: "rolesPagination", searchField: "name", label: (i) => i.name },
    team: { query: GET_TEAMS_WITH_BUDGETS, root: "teamsPagination", searchField: "name", label: (i) => i.name },
    project: { query: GET_PROJECTS_WITH_BUDGETS, root: "projectsPagination", searchField: "name", label: (i) => i.name },
    agent: { query: GET_AGENTS_WITH_BUDGETS, root: "agentsPagination", searchField: "name", label: (i) => i.name },
}

const PAGE_SIZE = 5

type PageInfo = {
    pageCount: number
    itemCount: number
    currentPage: number
    hasPreviousPage: boolean
    hasNextPage: boolean
}

const EMPTY_PAGE_INFO: PageInfo = {
    pageCount: 1,
    itemCount: 0,
    currentPage: 1,
    hasPreviousPage: false,
    hasNextPage: false,
}

type EditorState =
    | { mode: "single"; entityId: string; label: string; initial: BudgetInfo | null }
    | { mode: "bulk"; entityIds: string[]; label: string }
    | null

export default function BudgetsPage() {
    const { user } = useContext(UserContext)
    const client = useApolloClient()

    // Shared RBAC predicate — same source as the nav entry and the /budgets
    // route guard (which catches denied accounts server-side)
    const canRead = !!user && can(user, { area: "budget_management", level: "read" })
    const canWrite = !!user && can(user, { area: "budget_management", level: "write" })

    const [activeType, setActiveType] = useState<BudgetEntityType>("user")
    const [entities, setEntities] = useState<Entity[]>([])
    const [pageInfo, setPageInfo] = useState<PageInfo>(EMPTY_PAGE_INFO)
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [page, setPage] = useState(1)

    // Global default + show-in-chat settings.
    const [globalEnabled, setGlobalEnabled] = useState(false)
    const [globalAmount, setGlobalAmount] = useState("")
    const [globalDuration, setGlobalDuration] = useState<BudgetDuration>("30d")
    const [showInChat, setShowInChat] = useState(false)
    const [savingSettings, setSavingSettings] = useState(false)

    const [editor, setEditor] = useState<EditorState>(null)

    const activeMeta = BUDGET_ENTITY_TYPES.find((t) => t.type === activeType)!

    useEffect(() => {
        if (!canRead) return
        budgetsApi
            .getSettings()
            .then((s: BudgetSettings) => {
                setGlobalEnabled(s.global_user_budget.enabled)
                setGlobalAmount(
                    s.global_user_budget.max_budget
                        ? String(s.global_user_budget.max_budget)
                        : "",
                )
                setGlobalDuration((s.global_user_budget.budget_duration as BudgetDuration) || "30d")
                setShowInChat(s.show_user_budget_in_chat)
            })
            .catch(() => { })
    }, [canRead])

    const loadEntities = useCallback(
        async (type: BudgetEntityType, pageArg: number, searchArg: string) => {
            setLoading(true)
            try {
                const cfg = QUERY_MAP[type]
                const term = searchArg.trim()
                const filters = term
                    ? [{ [cfg.searchField]: { contains: term } }]
                    : []
                const { data } = await client.query({
                    query: cfg.query,
                    variables: { page: pageArg, limit: PAGE_SIZE, filters },
                    fetchPolicy: "network-only",
                })
                const root = data?.[cfg.root]
                const items: any[] = root?.items ?? []
                setEntities(
                    items.map((i) => ({
                        id: String(i.id),
                        label: cfg.label(i),
                        budget: (i.budget as BudgetInfo | null) ?? null,
                    })),
                )
                setPageInfo(root?.pageInfo ?? EMPTY_PAGE_INFO)
            } catch (err) {
                toast.error("Failed to load budgets", { description: err instanceof Error ? err.message : "Unknown error." })
                setEntities([])
                setPageInfo(EMPTY_PAGE_INFO)
            } finally {
                setLoading(false)
            }
        },
        [client],
    )

    // Debounce the search box so we don't query on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300)
        return () => clearTimeout(t)
    }, [search])

    // Reset to page 1 when switching entity type or search term.
    useEffect(() => {
        setPage(1)
        setSelected(new Set())
    }, [activeType, debouncedSearch])

    // Fetch the current page from the server.
    useEffect(() => {
        if (canRead) loadEntities(activeType, page, debouncedSearch)
    }, [activeType, page, debouncedSearch, canRead, loadEntities])

    const refreshBudgets = useCallback(async () => {
        await loadEntities(activeType, page, debouncedSearch)
    }, [activeType, page, debouncedSearch, loadEntities])

    const handleSaveSettings = async () => {
        const amount = Number(globalAmount)
        if (globalEnabled && (!Number.isFinite(amount) || amount <= 0)) {
            toast.error("Invalid amount", { description: "Set a positive budget to enable the global default." })
            return
        }
        setSavingSettings(true)
        try {
            await budgetsApi.saveSettings({
                global_user_budget: {
                    enabled: globalEnabled,
                    max_budget: Number.isFinite(amount) ? amount : 0,
                    budget_duration: globalDuration,
                },
                show_user_budget_in_chat: showInChat,
            })
            toast.success("Settings saved")
        } catch (err) {
            toast.error("Failed to save settings", { description: err instanceof Error ? err.message : "Unknown error." })
        } finally {
            setSavingSettings(false)
        }
    }

    const toggleOne = (id: string, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (checked) next.add(id)
            else next.delete(id)
            return next
        })
    }

    const toggleAll = (checked: boolean, ids: string[]) => {
        setSelected((prev) => {
            const next = new Set(prev)
            for (const id of ids) {
                if (checked) next.add(id)
                else next.delete(id)
            }
            return next
        })
    }

    const onEditorDone = () => {
        setEditor(null)
        setSelected(new Set())
        refreshBudgets()
    }

    if (!canRead) {
        return (
            <div className="container mx-auto max-w-7xl py-6">
                <Alert variant="destructive">
                    <Wallet className="h-4 w-4" />
                    <AlertDescription>
                        You don&apos;t have permission to manage budgets. Contact your
                        administrator to request access.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    const pageCount = Math.max(1, pageInfo.pageCount)
    const currentPage = pageInfo.currentPage || page
    const allOnPageSelected =
        entities.length > 0 && entities.every((e) => selected.has(e.id))

    return (
        <div className="container mx-auto max-w-7xl space-y-8 py-6">
            <header className="space-y-1">
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                    <Wallet className="h-6 w-6" />
                    Budgets
                </h1>
                <p className="text-muted-foreground">
                    Set spend budgets per user, role, team, project, or agent. Budgets are
                    enforced by LiteLLM on the entity&apos;s usage.
                </p>
            </header>

            {/* Per-entity budgets */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Entity budgets</CardTitle>
                    <CardDescription>
                        Select an entity type, then set individual budgets. Select multiple
                        rows to apply a budget to all of them at once.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Tabs
                        value={activeType}
                        onValueChange={(v) => setActiveType(v as BudgetEntityType)}
                    >
                        <TabsList>
                            {BUDGET_ENTITY_TYPES.map((t) => (
                                <TabsTrigger key={t.type} value={t.type}>
                                    {t.labelPlural}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>

                    {/* Compact global per-user default — only relevant on the Users tab. */}
                    {activeType === "user" && (
                        <Card>
                            <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="global-enabled"
                                        checked={globalEnabled}
                                        onCheckedChange={setGlobalEnabled}
                                        disabled={!canWrite}
                                    />
                                    <Label htmlFor="global-enabled" className="whitespace-nowrap font-medium">
                                        Global per-user budget
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="global-amount" className="text-muted-foreground">
                                        Amount
                                    </Label>
                                    <Input
                                        id="global-amount"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        placeholder="20"
                                        value={globalAmount}
                                        disabled={!canWrite || !globalEnabled}
                                        onChange={(e) => setGlobalAmount(e.target.value)}
                                        className="h-8 w-24"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-muted-foreground">Reset</Label>
                                    <Select
                                        value={globalDuration}
                                        onValueChange={(v) => setGlobalDuration(v as BudgetDuration)}
                                        disabled={!canWrite || !globalEnabled}
                                    >
                                        <SelectTrigger className="h-8 w-28">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {BUDGET_DURATIONS.map((d) => (
                                                <SelectItem key={d.value} value={d.value}>
                                                    {d.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="show-in-chat"
                                        checked={showInChat}
                                        onCheckedChange={setShowInChat}
                                        disabled={!canWrite}
                                    />
                                    <Label htmlFor="show-in-chat" className="whitespace-nowrap">
                                        Show budget status to user (in chat).
                                    </Label>
                                </div>
                                {canWrite && (
                                    <Button
                                        size="sm"
                                        onClick={handleSaveSettings}
                                        disabled={savingSettings}
                                        className="ml-auto"
                                    >
                                        {savingSettings ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="mr-2 h-4 w-4" />
                                        )}
                                        Save
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder={`Search ${activeMeta.labelPlural.toLowerCase()} by name…`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>

                    {canWrite && selected.size > 0 && (
                        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2">
                            <span className="text-sm">{selected.size} selected</span>
                            <Button
                                size="sm"
                                onClick={() =>
                                    setEditor({
                                        mode: "bulk",
                                        entityIds: Array.from(selected),
                                        label: `${selected.size} ${selected.size === 1
                                                ? activeMeta.label.toLowerCase()
                                                : activeMeta.labelPlural.toLowerCase()
                                            }`,
                                    })
                                }
                            >
                                <Wallet className="mr-2 h-4 w-4" />
                                Set budget for {selected.size} selected
                            </Button>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Loading…
                        </div>
                    ) : entities.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            {debouncedSearch.trim()
                                ? `No ${activeMeta.labelPlural.toLowerCase()} match “${debouncedSearch.trim()}”.`
                                : `No ${activeMeta.labelPlural.toLowerCase()} found.`}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {canWrite && (
                                        <TableHead className="w-10">
                                            <Checkbox
                                                checked={allOnPageSelected}
                                                onCheckedChange={(c) =>
                                                    toggleAll(!!c, entities.map((e) => e.id))
                                                }
                                                aria-label="Select all on page"
                                            />
                                        </TableHead>
                                    )}
                                    <TableHead className="w-1/4">{activeMeta.label}</TableHead>
                                    <TableHead>Budget</TableHead>
                                    <TableHead className="w-24 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entities.map((e) => {
                                    const budget = e.budget
                                    return (
                                        <TableRow key={e.id}>
                                            {canWrite && (
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selected.has(e.id)}
                                                        onCheckedChange={(c) => toggleOne(e.id, !!c)}
                                                        aria-label={`Select ${e.label}`}
                                                    />
                                                </TableCell>
                                            )}
                                            <TableCell className="font-medium">{e.label}</TableCell>
                                            <TableCell>
                                                <BudgetBar budget={budget} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {canWrite ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            setEditor({
                                                                mode: "single",
                                                                entityId: e.id,
                                                                label: e.label,
                                                                initial: budget,
                                                            })
                                                        }
                                                    >
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        {budget ? "Edit" : "Set"}
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">
                                                        Read only
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}

                    {!loading && pageInfo.itemCount > 0 && (
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm text-muted-foreground">
                                {(currentPage - 1) * PAGE_SIZE + 1}–
                                {Math.min(currentPage * PAGE_SIZE, pageInfo.itemCount)} of{" "}
                                {pageInfo.itemCount}
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!pageInfo.hasPreviousPage}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm">
                                    Page {currentPage} of {pageCount}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!pageInfo.hasNextPage}
                                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!editor} onOpenChange={(open) => !open && setEditor(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editor?.mode === "bulk" ? "Set budget" : "Edit budget"}
                        </DialogTitle>
                        <DialogDescription>
                            {editor ? editor.label : ""}
                        </DialogDescription>
                    </DialogHeader>
                    {editor &&
                        (editor.mode === "single" ? (
                            <BudgetEditor
                                mode="single"
                                entityType={activeType}
                                entityId={editor.entityId}
                                initial={editor.initial}
                                label={editor.label}
                                onDone={onEditorDone}
                                onCancel={() => setEditor(null)}
                            />
                        ) : (
                            <BudgetEditor
                                mode="bulk"
                                entityType={activeType}
                                entityIds={editor.entityIds}
                                label={editor.label}
                                onDone={onEditorDone}
                                onCancel={() => setEditor(null)}
                            />
                        ))}
                </DialogContent>
            </Dialog>
        </div>
    )
}
