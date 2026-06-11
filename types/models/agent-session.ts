// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export interface AgentSession {
    createdAt: string;
    updatedAt: string;
    id: string;
    metadata: any;
    agent: string;
    project: string;
    title: string;
    created_by: string | number;
    session_items: string[];
    rights_mode: ExuluRightsMode
    RBAC?: {
        type?: string;
        users?: Array<{ id: number; rights: 'read' | 'write' }>;
        roles?: Array<{ id: string; rights: 'read' | 'write' }>;
        teams?: Array<{ id: string; rights: 'read' | 'write' }>;
        // projects?: Array<{ id: string; rights: 'read' | 'write' }>;
    };
}
export type ExuluRightsMode = "private" | "users" | "roles" | "teams" | "public"/*  | "projects" */

export interface AgentMessage {
    id: string;
    thread_id: string;
    content: string;
    role: "function" | "data" | "user" | "system" | "assistant" | "tool";
    type: string;
    createdAt: Date;
}