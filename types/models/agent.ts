export interface Agent {
    id: string;
    modelName?: string;
    providerName?: string;
    backend: string;
    type: "agent";
    name: string;
    image?: string;
    providerapikey?: string;
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
    tools?: {
        id: string;
        type: string;
        config: {
            name: string;
            variable: string;
        }[];
        name: string;
        description: string;
    }[];
    maxContextLength?: number;
    authenticationInformation?: string;
    provider?: string;
    capabilities?: {
        text: boolean;
        images: imageTypes[];
        files: fileTypes[];
        audio: audioTypes[];
        video: videoTypes[];
    }
    // New RBAC fields
    rights_mode?: 'private' | 'users' | 'roles' | 'public' /* | 'projects' */;
    RBAC?: {
        type?: string;
        users?: Array<{ id: number; rights: 'read' | 'write' }>;
        roles?: Array<{ id: string; rights: 'read' | 'write' }>;
        /* projects?: Array<{ id: string; rights: 'read' | 'write' }>; */
    };
    // Lottie animation fields
    animation_idle?: string;
    animation_responding?: string;
    createdAt?: string;
    updatedAt?: string;
}

export type imageTypes = '.png' | '.jpg' | '.jpeg' | '.gif' | '.webp';
export type fileTypes = '.pdf' | '.docx' | '.xlsx' | '.xls' | '.csv' | '.pptx' | '.ppt';
export type audioTypes = '.mp3' | '.wav' | '.m4a' | '.mp4' | '.mpeg';
export type videoTypes = '.mp4' | '.m4a' | '.mp3' | '.mpeg' | '.wav';
export type lottieTypes = '.json';
export type allFileTypes = imageTypes | fileTypes | audioTypes | videoTypes | lottieTypes;