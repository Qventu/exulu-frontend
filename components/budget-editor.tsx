"use client"

/**
 * BudgetEditor — single or bulk budget upsert form.
 *
 * Cross-feature stability: BudgetEditor is consumed ONLY by /budgets today, so
 * internal refactors are fine but the prop API stays additive (no breaking
 * changes / no renames). The current additive surface area:
 *  - `hideRemove?: boolean` — suppresses the inner destructive Remove button
 *    so the route-local wrapper can own the destructive lifecycle behind
 *    `<ConfirmDialog>` (rule #5 + budgets.md item 39 — the #1 High UX bug).
 *  - `onBulkComplete?: (results) => void` — surfaces the per-entity bulk
 *    results (BulkBudgetResult.error) so the wrapper can render a partial-
 *    failure detail list (budgets.md ladder item 38). When provided, the
 *    editor SUPPRESSES its own success/error toast for bulk mode and DEFERS
 *    `onDone()` to the wrapper.
 *
 * All copy is i18n'd via the `budgets.editor.*` and `policy.duration.*`
 * namespaces (budgets.md §4 — German users were seeing English strings).
 */

import { Loader2, Trash2, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

import { BudgetBar } from "@/components/budget-bar"
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
import { budgetsApi, type BulkBudgetResult } from "@/lib/api/budgets"
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
    /**
     * Suppress the editor's own inline destructive Remove button. The route-
     * local wrapper takes ownership of the destructive path so it can gate
     * the call behind `<ConfirmDialog>` (the page-doc's #1 High UX fix).
     */
    hideRemove?: boolean
    /**
     * Suppress the inner "Current status" BudgetBar so the wrapper can render
     * its own keyboard/touch-reachable variant (BudgetBarWithDetails) —
     * budgets.md ladder item 32 / responsive.md T7.
     */
    hideCurrentStatus?: boolean
    /**
     * Bulk-only: receive the per-entity results so the wrapper can render a
     * "View details" partial-failure list (budgets.md item 38). When passed,
     * the editor will NOT toast on its own for bulk mode.
     */
    onBulkComplete?: (results: BulkBudgetResult[]) => void
} & (
    | { mode: "single"; entityId: string; initial: BudgetInfo | null; entityIds?: never }
    | { mode: "bulk"; entityIds: string[]; entityId?: never; initial?: never }
)

export function BudgetEditor(props: BudgetEditorProps) {
    const {
        entityType,
        label,
        mode,
        onDone,
        onCancel,
        hideRemove,
        hideCurrentStatus,
        onBulkComplete,
    } = props
    const existing = mode === "single" ? props.initial : null
    const t = useTranslations("budgets")

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
                toast.success(t("editor.savedTitle"), {
                    description: t("editor.savedDescription", { name: label }),
                })
                onDone()
            } else {
                const results = await budgetsApi.bulkUpsert(entityType, props.entityIds, {
                    max_budget: amountValue,
                    budget_duration: duration,
                })
                if (onBulkComplete) {
                    // Defer toast + onDone to the wrapper so it can show the
                    // per-entity failure detail list (budgets.md item 38).
                    onBulkComplete(results)
                } else {
                    const ok = results.filter((r) => r.ok).length
                    const failed = results.length - ok
                    if (failed > 0) {
                        toast.error(t("editor.bulkAppliedTitle"), {
                            description: t("editor.bulkPartialSummary", { ok, failed }),
                        })
                    } else {
                        toast.success(t("editor.bulkAppliedTitle"), {
                            description: t("editor.bulkAllSucceeded", { ok }),
                        })
                    }
                    onDone()
                }
            }
        } catch (err) {
            toast.error(t("editor.saveFailedTitle"), {
                description: err instanceof Error ? err.message : t("editor.unknownError"),
            })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (mode !== "single") return
        setDeleting(true)
        try {
            await budgetsApi.remove(entityType, props.entityId)
            toast.success(t("editor.removedTitle"), {
                description: t("editor.removedDescription", { name: label }),
            })
            onDone()
        } catch (err) {
            toast.error(t("editor.removeFailedTitle"), {
                description: err instanceof Error ? err.message : t("editor.unknownError"),
            })
        } finally {
            setDeleting(false)
        }
    }

    const showInnerRemove =
        mode === "single" &&
        existing != null &&
        existing.max_budget != null &&
        !hideRemove

    return (
        <div className="space-y-5">
            {mode === "single" && existing && existing.max_budget != null && !hideCurrentStatus && (
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                        {t("editor.currentStatus")}
                    </Label>
                    <BudgetBar budget={existing} />
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="budget-amount">{t("editor.amountLabel")}</Label>
                <Input
                    id="budget-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder={t("editor.amountPlaceholder")}
                    value={amount}
                    disabled={busy}
                    onChange={(e) => setAmount(e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label>{t("editor.resetLabel")}</Label>
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
                                {t(`policy.duration.${d.value}`)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center justify-between gap-3 border-t pt-4">
                {showInnerRemove ? (
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
                        {t("editor.remove")}
                    </Button>
                ) : (
                    <span />
                )}
                <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                        {t("editor.cancel")}
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={busy || !amountValid}>
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Wallet className="mr-2 h-4 w-4" />
                        )}
                        {mode === "bulk" ? t("editor.applyToAll") : t("editor.saveBudget")}
                    </Button>
                </div>
            </div>
        </div>
    )
}
