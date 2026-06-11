/**
 * Tier-boundary lint exemptions (codebase-structure §1.2, IMPLEMENTATION_PLAN 0.2).
 *
 * THIS LIST MAY ONLY SHRINK. Never add entries.
 *
 * Each file listed here predates the tier-boundary guardrails and is exempted
 * from its tier's import rules (it keeps the global rules, e.g. the `@/util`
 * ban). When a file is cleaned up — typically by its page's Wave-2 redesign PR
 * (queries/queries.ts extraction, QueuePanel/PromptCard promotions, rights
 * context extraction) — remove its entry in the same PR.
 */

/**
 * Files exempted from their tier's `no-restricted-imports` boundary rules,
 * keyed by the config zone they would otherwise belong to.
 */
export const tierBoundaryExemptions = {
  // components/ui/ — clean.
  "components/ui": [],
  // components/primitives/ — clean.
  "components/primitives": [],
  // Both still read from the legacy queries/queries.ts monolith.
  "components/widgets": [
    "components/widgets/role-selector.tsx",
    "components/widgets/team-selector.tsx",
  ],
  // Imports UserContext from app/(application)/authenticated.tsx.
  "components/shell": ["components/shell/main-nav.tsx"],
  // Still reads from the legacy queries/queries.ts monolith.
  lib: ["lib/validate-preset-items.ts"],
  // Cross-feature imports awaiting their Wave-2 promotions
  // (PromptCard/PromptEditorModal, PromptVariableForm, QueueManagement,
  // VariableSelectionElement).
  features: [
    "app/(application)/agents/edit/[id]/components/prompt-browser-sheet.tsx",
    "app/(application)/agents/edit/[id]/form.tsx",
    "app/(application)/prompts/components/prompt-preview.tsx",
    "app/(application)/workflows/page.tsx",
    "app/(application)/data/components/embeddings.tsx",
    "app/(application)/data/components/sources.tsx",
    "app/(application)/data/components/processors.tsx",
  ],
};

/**
 * Files in migrated folders exempted from `react/jsx-no-literals`
 * (i18n exit criterion, design-system audit rec 10). Populated with the
 * pre-existing violators at the time the rule landed; fix via `common.*`
 * namespace translations and remove the entry.
 */
export const jsxLiteralExemptions = [
  "components/primitives/rating.tsx",
  "components/shell/main-nav.tsx",
  "components/shell/mode-toggle.tsx",
  "components/shell/navigation.tsx",
  "components/widgets/role-selector.tsx",
  "components/widgets/team-selector.tsx",
];
