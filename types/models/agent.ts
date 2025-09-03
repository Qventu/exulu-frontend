export interface Agent {
    id: string;
    modelName?: string;
    providerName?: string;
    backend: string;
    type: "chat" | "flow" | "custom";
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
    tools?: {
        toolId: string;
        config: {
            name: string;
            variable: string;
        }[];
        name: string;
        description: string;
    }[];
    capabilities?: {
        text: boolean;
        images: string[];
        files: string[];
        audio: string[];
        video: string[];
    }
    // New RBAC fields
    rights_mode?: 'private' | 'users' | 'roles' | 'public' | 'project';
    RBAC?: {
        type?: string;
        users?: Array<{ id: string; rights: 'read' | 'write' }>;
        roles?: Array<{ id: string; rights: 'read' | 'write' }>;
    };
    createdAt?: string;
    updatedAt?: string;
}