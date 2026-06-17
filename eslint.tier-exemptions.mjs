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
  // components/primitives/ — FilePicker + QueuePanel were promoted to
  // primitives with their data-layer reach-ins preserved (work item 2.11).
  // FilePicker imports lib/api/files + shell/config-context (Uppy hook).
  // QueuePanel imports @apollo/client + queries/queries.ts (the operations
  // owner — queues are a platform concern, not a feature-local op-set).
  // Both deviations are recorded in work item 2.11 deviations.
  "components/primitives": [
    "components/primitives/file-picker.tsx",
    "components/primitives/queue-panel.tsx",
  ],
  // Both still read from the legacy queries/queries.ts monolith.
  "components/widgets": [
    "components/widgets/role-selector.tsx",
    "components/widgets/team-selector.tsx",
  ],
  // components/shell/ — clean (main-nav.tsx deleted in Phase 1).
  "components/shell": [],
  // Still reads from the legacy queries/queries.ts monolith.
  lib: ["lib/validate-preset-items.ts"],
  // Cross-feature imports awaiting their Wave-2 promotions
  // (PromptCard/PromptEditorModal, PromptVariableForm, QueueManagement,
  // VariableSelectionElement).
  features: [
    "app/(application)/agents/edit/[id]/components/prompt-browser-sheet.tsx",
    // PromptCard reuse preserved verbatim from the legacy form.tsx through
    // the 2.8 redesign — agents.md §4 marks PromptCard/PromptEditorModal
    // as "reused as-is", promotion is scoped to the prompts redesign.
    "app/(application)/agents/edit/[id]/sections/instructions.tsx",
    "app/(application)/agents/edit/[id]/form.tsx",
    "app/(application)/workflows/page.tsx",
    // stage-embedder reuses agents/edit/form.tsx's VariableSelectionElement
    // (the cross-feature pattern that already accumulated 3 exemptions
    // above) — work item 2.11. Promotion of VariableSelectionElement to
    // components/widgets is queued for the variables redesign work item.
    "app/(application)/data/[ctx]/components/stage-embedder.tsx",
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
  // FilePicker + QueuePanel use punctuation-only literals ("MB", "/", ":",
  // "(", ")", "·") as visual separators between i18n'd values. Marking
  // these as exemptions keeps the rule strict for content while accepting
  // the documented architectural deviations from work item 2.11.
  "components/primitives/file-picker.tsx",
  "components/primitives/queue-panel.tsx",
  "components/widgets/role-selector.tsx",
  "components/widgets/team-selector.tsx",
];
