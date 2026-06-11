// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export const VectorMethodEnum = {
    "cosineDistance": "cosineDistance",
    "hybridSearch": "hybridSearch",
    "tsvector": "tsvector"
} as const;

export type VectorMethod = (typeof VectorMethodEnum)[keyof typeof VectorMethodEnum];