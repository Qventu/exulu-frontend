// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export type UserRole = {
  id: string;
  name: string;
  agents?: "read" | "write" | null;
  workflows?: "read" | "write" | null;
  variables?: "read" | "write" | null;
  users?: "read" | "write" | null;
  api?: "read" | "write" | null;
  evals?: "read" | "write" | null;
  budget_management?: "read" | "write" | null;
  createdAt?: string;
  updatedAt?: string;
};
