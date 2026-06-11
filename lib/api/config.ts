import { getToken, getUris } from "@/lib/api/client";

export type BackendConfigType = {
    fileUploads?: {
        s3endpoint: string;
    }
    workers?: {
        redisHost: string;
        enabled: boolean;
    }
    entitlements?: Record<string, boolean>;
    liteLLM?: {
        enabled: boolean;
    }
}

export type FeedbackConfig = {
    enabled: boolean;
    backend: string;
    featureAgentSlug: string;
    featureAgentId: string;
    bugAgentSlug: string;
    bugAgentId: string;
}

export type ThemeConfig = {
    light?: Record<string, string>;
    dark?: Record<string, string>;
}

export const configApi = {
    backend: async (): Promise<Response> => {
        const uris = await getUris();
        const url = `${uris.base}/config`
        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
    },
    theme: async (): Promise<ThemeConfig> => {
        try {
            const token = await getToken();
            const uris = await getUris();
            const res = await fetch(`${uris.base}/theme`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            })
            if (!res.ok) {
                console.error("[EXULU] Error fetching theme config:", res.statusText)
                throw new Error("Failed to fetch theme config.")
            }
            const json = await res.json();
            return json.theme;
        } catch (error) {
            console.error("Error fetching theme config:", error);
            return { light: {}, dark: {} };
        }
    }
}
