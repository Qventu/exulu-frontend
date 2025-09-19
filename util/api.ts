import { getSession } from "next-auth/react";

export type ImageStyle = "origami" | "anime" | "japanese_anime" | "vaporwave" | "lego" | "paper_cut" | "felt_puppet" | "3d" | "app_icon" | "pixel_art" | "isometric";

const getUris = async () => {
    const context = await fetch("/api/config").then(res => res.json());
    if (!context.backend) {
        throw new Error("No backend set.")
    }
    return {
        files:
            context.backend,
        base:
            context.backend
    }
}

export const getToken = async () => {
    const session = await getSession()
    // @ts-ignore
    return session?.user?.jwt;
}


export const agents = {
    image: {
        generate: async (parameters: {
            name: string,
            description: string,
            style?: ImageStyle
        }): Promise<any> => {
            const uris = await getUris();
            const url = `${uris.base}/generate/agent/image`;
            const token = await getToken()

            if (!token) {
                throw new Error("No valid session token available.")
            }

            return fetch(url, {
                method: "POST",
                body: JSON.stringify(parameters),
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
        }
    }
}

export const files = {
    download: async (key: string) => {

        const uris = await getUris();
        let url = `${uris.files}/s3/download?key=${key}`;

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    },
    delete: async (key: string) => {
        
        const uris = await getUris();
        let url = `${uris.files}/s3/delete?key=${key}`;
        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    }
}
