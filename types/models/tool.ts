// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export interface ExuluTool {
    id: string;
    name: string;
    description: string;
    type: string;
    category: string;
    inputSchema: any;
    outputSchema: any;
    config: {
        name: string;
        description: string;
        type: "boolean" | "string" | "number" | "variable";
        default?: string | boolean | number | "variable";
        value?: string; // the exulu variable reference
    }[];
}
