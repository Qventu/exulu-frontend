"use client";

/**
 * L2 entity-config area (wrapped in `<DetailSection>` from the parent
 * BudgetsView). Owns the entity-type Tabs/Select, the Toolbar (search +
 * reserved status-filter slot), BulkActionBar, and the table itself.
 *
 * URL state is the source of truth: budgets-view seeds `activeType` /
 * `search` from ?type= / ?search= deep-links from the L1 AttentionList;
 * this component writes back via the controlled props. There is no parallel
 * local copy that races (QA discipline). Selection accumulates across pages
 * within a type — visible via BulkActionBar's "n selected" + Clear button.
 *
 * Status filter slot is RESERVED but renders nothing until
 * BUDGETS_STATUS_FILTER_SUPPORTED flips true (backend endpoint not yet
 * shipped — budgets.md Fallback rule explicitly forbids client-side sieving).
 */

import { Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { BulkActionBar } from "@/components/primitives/bulk-action-bar";
import { Toolbar } from "@/components/primitives/toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BUDGETS_STATUS_FILTER_SUPPORTED,
  BUDGETS_USER_SEARCH_NAME_OR_EMAIL_SUPPORTED,
} from "@/lib/budget-supported";
import { BUDGET_ENTITY_TYPES, type BudgetEntityType } from "@/lib/budget";

import { useEntityList } from "../hooks";
import { BudgetEditorDialog, type EditorState } from "./budget-editor-dialog";
import { EntityBudgetTable } from "./entity-budget-table";

export interface EntityConfigSectionProps {
  enabled: boolean;
  canWrite: boolean;
  /** URL-derived (source of truth). */
  activeType: BudgetEntityType;
  onActiveTypeChange: (type: BudgetEntityType) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export function EntityConfigSection({
  enabled,
  canWrite,
  activeType,
  onActiveTypeChange,
  search,
  onSearchChange,
}: EntityConfigSectionProps) {
  const t = useTranslations("budgets");

  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [editor, setEditor] = React.useState<EditorState>(null);

  // Tab/search change resets page + selection (budgets.md item 15).
  React.useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [activeType, search]);

  const { entities, pageInfo, loading, error, refetch } = useEntityList(
    activeType,
    page,
    search,
    enabled,
  );

  // Surface load failures as toasts too (budgets.md item 22 — keep the
  // legacy toast as well as the inline retry baked into DataTable).
  const prevErrorRef = React.useRef<Error | null>(null);
  React.useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      toast.error(t("table.loadErrorTitle"), {
        description: error.message,
      });
    }
    prevErrorRef.current = error;
  }, [error, t]);

  const handleEdit = React.useCallback(
    (row: { id: string; label: string; budget: import("@/lib/budget").BudgetInfo | null }) => {
      setEditor({
        mode: "single",
        entityId: row.id,
        label: row.label,
        initial: row.budget,
      });
    },
    [],
  );

  const handleBulk = React.useCallback(() => {
    if (selected.length === 0) return;
    const label =
      selected.length === 1
        ? `${selected.length} ${t(`entityType.${activeType}`).toLowerCase()}`
        : `${selected.length} ${t(`entityTypePlural.${activeType}`).toLowerCase()}`;
    setEditor({
      mode: "bulk",
      entityIds: selected,
      label,
    });
  }, [selected, activeType, t]);

  const handleEditorDone = React.useCallback(async () => {
    setEditor(null);
    setSelected([]);
    await refetch();
  }, [refetch]);

  const searchPlaceholder =
    activeType === "user"
      ? BUDGETS_USER_SEARCH_NAME_OR_EMAIL_SUPPORTED
        ? t("search.placeholderByNameOrEmail")
        : t("search.placeholderByEmail")
      : t("search.placeholderByName", {
          type: t(`entityTypePlural.${activeType}`).toLowerCase(),
        });

  return (
    <div className="space-y-4">
      {/* Entity-type switcher: tabs ≥md, full-width select <md. */}
      <div className="md:hidden">
        <Select
          value={activeType}
          onValueChange={(value) => onActiveTypeChange(value as BudgetEntityType)}
        >
          <SelectTrigger aria-label={t("entityTypeSwitcherAria")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUDGET_ENTITY_TYPES.map((meta) => (
              <SelectItem key={meta.type} value={meta.type}>
                {t(`entityTypePlural.${meta.type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="hidden md:block">
        <Tabs
          value={activeType}
          onValueChange={(value) => onActiveTypeChange(value as BudgetEntityType)}
        >
          <TabsList>
            {BUDGET_ENTITY_TYPES.map((meta) => (
              <TabsTrigger key={meta.type} value={meta.type}>
                {t(`entityTypePlural.${meta.type}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Toolbar
        search={{
          value: search,
          onChange: onSearchChange,
          placeholder: searchPlaceholder,
        }}
        // Reserved status-filter slot — renders nothing until backend ships
        // the phase-1 endpoint (lib/budget-supported.ts).
        filters={BUDGETS_STATUS_FILTER_SUPPORTED ? null : undefined}
      />

      {canWrite ? (
        <BulkActionBar
          count={selected.length}
          onClear={() => setSelected([])}
          // budgets.md item 24 — the "across pages" framing makes it clear
          // the selection set spans pages the admin isn't currently looking
          // at (selection accumulates per type via DataTable selection).
          label={t("bulk.selectedAcrossPages", { count: selected.length })}
          actions={[
            {
              label: t("bulk.apply", {
                count: selected.length,
                type:
                  selected.length === 1
                    ? t(`entityType.${activeType}`).toLowerCase()
                    : t(`entityTypePlural.${activeType}`).toLowerCase(),
              }),
              onClick: handleBulk,
            },
          ]}
        />
      ) : null}

      <EntityBudgetTable
        entityType={activeType}
        rows={entities}
        pageInfo={pageInfo}
        loading={loading}
        error={error}
        page={page}
        onPageChange={setPage}
        onRetry={() => {
          void refetch();
        }}
        search={search}
        canWrite={canWrite}
        selected={selected}
        onSelectedChange={setSelected}
        onEdit={handleEdit}
        onClearSearch={() => onSearchChange("")}
      />

      <BudgetEditorDialog
        state={editor}
        entityType={activeType}
        onClose={() => setEditor(null)}
        onDone={() => {
          void handleEditorDone();
        }}
      />

    </div>
  );
}
