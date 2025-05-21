import { Tool } from "./tool";

export interface Agent {
    id: string;
    backend: string;
    type: "chat" | "flow";
    extensions: string[];
    name: string;
    active?: boolean;
    public?: boolean;
    description?: string;
    slug?: string;
    availableTools?: Tool[];
    enabledTools?: string[];
    capabilities?: {
        tools: boolean;
        images: string[];
        files: string[];
        audio: string[];
        video: string[];
    }
}