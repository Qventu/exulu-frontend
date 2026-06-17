// MIGRATION-SHIM: remove by 2026-09-01
//
// form.tsx survives as a one-release re-export shim because the Knowledge
// feature still imports `VariableSelectionElement` from this path
// (app/(application)/data/components/embeddings.tsx:44, used at :241). The
// agents editor itself no longer mounts AgentForm — work item 2.8 split the
// 1,653-line god file into edit/[id]/{sections,components,hooks,queries}.
// The Knowledge redesign will rewire that import to the canonical location
// (./components/variable-selection-element) at which point this file is
// deleted.

export { VariableSelectionElement } from "./components/variable-selection-element";
