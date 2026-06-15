"use client";

/**
 * /budgets — the monitoring-first root client component (budgets.md §3).
 *
 * Layout:
 *  1. PageHeader (H1 "Budgets", LiteLLM-naming subline, right slot =
 *     DefaultPolicyChip with the platform default summary).
 *  2. "Budgets at risk" AttentionList — THE redesign headline.
 *  3. <DetailSection title="All budgets" defaultOpen> wrapping the L2
 *     entity-config area (tabs + toolbar + bulk + table).
 *  4. DefaultPolicyDialog (L3) mounted at the root.
 *
 * Access-denied users get the shared `<AccessDenied>` surface (rule #5).
 *
 * URL state is the source of truth for deep-link targets from the
 * AttentionList rows: `?type=&search=` seeds the L2 section. Tab/search
 * changes inside the section write back to the URL on commit.
 */

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { AccessDenied } from "@/components/primitives/access-denied";
import { DetailSection } from "@/components/primitives/detail-section";
import { PageHeader } from "@/components/primitives/page-header";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";
import { UserContext } from "@/app/(application)/authenticated";
import { can } from "@/lib/rights";
import {
  BUDGET_ENTITY_TYPES,
  type BudgetEntityType,
} from "@/lib/budget";

import { useBudgetSettings } from "../hooks";
import { BudgetsAtRisk } from "./budgets-at-risk";
import { DefaultPolicyChip } from "./default-policy-chip";
import { DefaultPolicyDialog } from "./default-policy-dialog";
import { EntityConfigSection } from "./entity-config-section";

function isBudgetEntityType(value: string | null): value is BudgetEntityType {
  return !!value && BUDGET_ENTITY_TYPES.some((meta) => meta.type === value);
}

export function BudgetsView() {
  const t = useTranslations("budgets");
  const { user } = React.useContext(UserContext);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Shared RBAC predicate — same source as the nav entry and the
  // /budgets route guard.
  const canRead = !!user && can(user, { area: "budget_management", level: "read" });
  const canWrite = !!user && can(user, { area: "budget_management", level: "write" });

  // URL state (single source of truth for the L2 section).
  const typeParam = searchParams.get("type");
  const activeType: BudgetEntityType = isBudgetEntityType(typeParam)
    ? typeParam
    : "user";
  const search = searchParams.get("search") ?? "";

  const updateUrl = React.useCallback(
    (next: { type?: BudgetEntityType; search?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.type !== undefined) {
        if (next.type === "user") params.delete("type");
        else params.set("type", next.type);
      }
      if (next.search !== undefined) {
        const value = next.search ?? "";
        if (value === "") params.delete("search");
        else params.set("search", value);
      }
      const query = params.toString();
      router.replace(query ? `/budgets?${query}` : "/budgets", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const handleActiveTypeChange = React.useCallback(
    (next: BudgetEntityType) => {
      // Tab change resets search (budgets.md item 15).
      updateUrl({ type: next, search: null });
    },
    [updateUrl],
  );

  const handleSearchChange = React.useCallback(
    (next: string) => {
      updateUrl({ search: next });
    },
    [updateUrl],
  );

  const settingsHook = useBudgetSettings(canRead);
  const [policyOpen, setPolicyOpen] = React.useState(false);

  if (!canRead) {
    return <AccessDenied requiredRight="budget_management" />;
  }

  const policyChip = (
    <DefaultPolicyChip
      settings={settingsHook.settings}
      loading={settingsHook.loading}
      loadError={settingsHook.error}
      canWrite={canWrite}
      onEdit={() => setPolicyOpen(true)}
      onRetryLoad={settingsHook.refetch}
    />
  );

  return (
    <>
      {canWrite ? (
        <MobileTopbarAction>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPolicyOpen(true)}
          >
            {t("policy.edit")}
          </Button>
        </MobileTopbarAction>
      ) : null}

      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={policyChip}
      />

      <BudgetsAtRisk enabled={canRead} />

      <DetailSection title={t("allBudgets.title")} defaultOpen>
        <EntityConfigSection
          enabled={canRead}
          canWrite={canWrite}
          activeType={activeType}
          onActiveTypeChange={handleActiveTypeChange}
          search={search}
          onSearchChange={handleSearchChange}
        />
      </DetailSection>

      <DefaultPolicyDialog
        open={policyOpen}
        onOpenChange={setPolicyOpen}
        settings={settingsHook.settings}
        loadError={settingsHook.error}
        onRetryLoad={settingsHook.refetch}
        onSave={settingsHook.save}
      />
    </>
  );
}
