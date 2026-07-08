// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export interface AgentTool {
    id: string;
    type: string;
    config: {
        name: string;
        variable: string;
        type: "boolean" | "string" | "number" | "variable" | "json";
    }[];
    name: string;
    description?: string;
}
export interface Agent {
    id: string;
    feedback?: boolean;
    suggestions_enabled?: boolean;
    sandbox_enabled?: boolean;
    max_tool_steps?: number | null;
    modelName?: string;
    providerName?: string;
    welcomemessage?: string;
    defaultagent?: boolean;
    type: "agent";
    name: string;
    image?: string;
    /** FK to models.id — replaces legacy provider + providerapikey columns. */
    model?: string;
    workflows?: {
        enabled: boolean;
        queue?: {
            name: string;
        };
    };
    firewall?: {
        enabled: boolean;
        scanners?: {
            promptGuard: boolean;
            codeShield: boolean;
            agentAlignment: boolean;
            hiddenAscii: boolean;
            piiDetection: boolean;
        }
    }
    active?: boolean;
    description?: string;
    instructions?: string;
    slug?: string;
    tools?: AgentTool[];
    skills?: { id: string; name: string }[];
    maxContextLength?: number;
    authenticationInformation?: string;
    systemInstructions?: string;
    /** @deprecated Hydrated for read compatibility; underlying column was removed. */
    provider?: string;
    capabilities?: {
        text: boolean;
        images: imageTypes[];
        files: fileTypes[];
        audio: audioTypes[];
        video: videoTypes[];
    }
    // New RBAC fields
    rights_mode?: 'private' | 'users' | 'roles' | 'teams' | 'public' /* | 'projects' */;
    RBAC?: {
        type?: string;
        users?: Array<{ id: number; rights: 'read' | 'write' }>;
        roles?: Array<{ id: string; rights: 'read' | 'write' }>;
        teams?: Array<{ id: string; rights: 'read' | 'write' }>;
        /* projects?: Array<{ id: string; rights: 'read' | 'write' }>; */
    };
    // Lottie animation fields
    animation_idle?: string;
    animation_responding?: string;
    // Native memory context
    memory?: string;
    createdAt?: string;
    updatedAt?: string;
}

export type imageTypes = '.png' | '.jpg' | '.jpeg' | '.gif' | '.webp';
export type fileTypes = '.pdf' | '.docx' | '.xlsx' | '.xls' | '.csv' | '.pptx' | '.ppt';
export type audioTypes = '.mp3' | '.wav' | '.m4a' | '.mp4' | '.mpeg';
export type videoTypes = '.mp4' | '.m4a' | '.mp3' | '.mpeg' | '.wav';
export type lottieTypes = '.json';
export type allFileTypes = imageTypes | fileTypes | audioTypes | videoTypes | lottieTypes;