import { Tool } from "./tool";

export interface Agent {
    id: string;
    provider?: string;
    model?: string;
    backend: string;
    type: "chat" | "flow" | "custom";
    extensions: string[];
    name: string;
    image?: string;
    providerApiKey?: string;
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
    slug?: string;
    availableTools?: Tool[];
    enabledTools?: {
        toolId: string;
        config: {
            name: string;
            variable: string;
        }[];
    }[];
    capabilities?: {
        text: boolean;
        images: string[];
        files: string[];
        audio: string[];
        video: string[];
    }
    // New RBAC fields
    rights_mode?: 'private' | 'users' | 'roles' | 'public';
    RBAC?: {
        type?: string;
        users?: Array<{ id: string; rights: 'read' | 'write' }>;
        roles?: Array<{ id: string; rights: 'read' | 'write' }>;
    };
    createdAt?: string;
    updatedAt?: string;
}