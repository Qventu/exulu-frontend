import { Tool } from "./tool";

export interface Agent {
    id: string;
    provider?: string;
    model?: string;
    backend: string;
    type: "chat" | "flow" | "custom";
    extensions: string[];
    name: string;
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
    public?: boolean;
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
        tools: boolean;
        images: string[];
        files: string[];
        audio: string[];
        video: string[];
    }
}