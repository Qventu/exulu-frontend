// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

import type { BudgetInfo } from "@/lib/budget";

export interface Project {
    id: string;
    name: string;
    description: string;
    custom_instructions: string;
    rights_mode?: 'private' | 'users' | 'roles' | 'teams' | 'public'/*  | 'projects' */;
    created_by?: string;
    project_items?: string[]; // array of items as global ids ('<context_id>/<item_id>')
    RBAC?: {
        type?: string;
        users?: Array<{ id: number; rights: 'read' | 'write' }>;
        roles?: Array<{ id: string; rights: 'read' | 'write' }>;
        teams?: Array<{ id: string; rights: 'read' | 'write' }>;
        // projects?: Array<{ id: string; rights: 'read' | 'write' }>;
    };
    createdAt?: string;
    updatedAt?: string;
    /** Computed budget view (GET_PROJECT_BY_ID only): full tag info for
     *  budget admins, reduced member view (with `display` echo) for project
     *  members, null when unset or hidden. */
    budget?: BudgetInfo | null;
}