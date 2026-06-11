"use client"

import { useState } from "react"
import { Loader2, Trash2, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { BudgetBar } from "@/components/budget-bar"
import { budgetsApi } from "@/lib/api/budgets"
import {
    BUDGET_DURATIONS,
    type BudgetDuration,
    type BudgetEntityType,
    type BudgetInfo,
} from "@/lib/budget"

type BudgetEditorProps = {
    entityType: BudgetEntityType
    /** Display label: an entity name (single) or e.g. "3 projects" (bulk). */
    label: string
    /** Called after a successful save/delete so the parent can refresh + close. */
    onDone: () => void
    onCancel: () => void
} & (
    | { mode: "single"; entityId: string; initial: BudgetInfo | null; entityIds?: never }
    | { mode: "bulk"; entityIds: string[]; entityId?: never; initial?: never }
)

export function BudgetEditor(props: BudgetEditorProps) {
    const { entityType, label, mode, onDone, onCancel } = props
    const existing = mode === "single" ? props.initial : null

    const [amount, setAmount] = useState<string>(
        existing?.max_budget != null ? String(existing.max_budget) : "",
    )
    const [duration, setDuration] = useState<BudgetDuration>(
        (existing?.budget_duration as BudgetDuration) || "30d",
    )
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const amountValue = Number(amount)
    const amountValid = Number.isFinite(amountValue) && amountValue > 0
    const busy = saving || deleting

    const handleSave = async () => {
        if (!amountValid) return
        setSaving(true)
        try {
            if (mode === "single") {
                await budgetsApi.upsert(entityType, props.entityId, {
                    max_budget: amountValue,
                    budget_duration: duration,
                })
                toast.success("Budget saved", { description: `Budget set for ${label}.` })
            } else {
                const results = await budgetsApi.bulkUpsert(entityType, props.entityIds, {
                    max_budget: amountValue,
                    budget_duration: duration,
                })
                const ok = results.filter((r) => r.ok).length
                const failed = results.length - ok
                ;(failed ? toast.error : toast.success)("Budgets applied", {
                    description: `${ok} succeeded${failed ? `, ${failed} failed` : ""}.`,
                })
            }
            onDone()
        } catch (err) {
            toast.error("Failed to save budget", { description: err instanceof Error ? err.message : "Unknown error." })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (mode !== "single") return
        setDeleting(true)
        try {
            await budgetsApi.remove(entityType, props.entityId)
            toast.success("Budget removed", { description: `Budget removed for ${label}.` })
            onDone()
        } catch (err) {
            toast.error("Failed to remove budget", { description: err instanceof Error ? err.message : "Unknown error." })
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="space-y-5">
            {mode === "single" && existing && existing.max_budget != null && (
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Current status</Label>
                    <BudgetBar budget={existing} />
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="budget-amount">Budget (USD)</Label>
                <Input
                    id="budget-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="e.g. 20"
                    value={amount}
                    disabled={busy}
                    onChange={(e) => setAmount(e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label>Reset period</Label>
                <Select
                    value={duration}
                    onValueChange={(v) => setDuration(v as BudgetDuration)}
                    disabled={busy}
                >
                    <SelectTrigger>
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

            <div className="flex items-center justify-between gap-3 border-t pt-4">
                {mode === "single" && existing && existing.max_budget != null ? (
                    <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={handleDelete}
                        disabled={busy}
                    >
                        {deleting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Remove
                    </Button>
                ) : (
                    <span />
                )}
                <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={busy || !amountValid}>
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Wallet className="mr-2 h-4 w-4" />
                        )}
                        {mode === "bulk" ? "Apply to all" : "Save budget"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
