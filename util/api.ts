import { getSession } from "next-auth/react";

export type ImageStyle = "origami" | "anime" | "japanese_anime" | "vaporwave" | "lego" | "paper_cut" | "felt_puppet" | "3d" | "app_icon" | "pixel_art" | "isometric";

const getUris = async () => {
    // Server-side: use environment variable directly
    if (typeof window === 'undefined') {
        const backend = process.env.BACKEND;
        if (!backend) {
            throw new Error("No backend set.")
        }
        return {
            files: backend,
            base: backend
        }
    }

    // Client-side: fetch from API
    const context = await fetch("/api/config").then(res => res.json());
    if (!context.backend) {
        throw new Error("No backend set.")
    }
    return {
        files: context.backend,
        base: context.backend
    }
}

export const getToken = async () => {
    const session = await getSession()
    // @ts-ignore
    return session?.user?.jwt;
}

export type BackendConfigType = {
    fileUploads?: {
        s3endpoint: string;
    }
    workers?: {
        redisHost: string;
        enabled: boolean;
    }
}

export const config = {
    backend: async (): Promise<Response> => {
        const uris = await getUris();
        const url = `${uris.base}/config`
        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
    }
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

export type S3FileListOutput = {
    "$metadata": {
        "httpStatusCode": number,
        "attempts": number,
        "totalRetryDelay": number
    },
    "Contents": {
        "Key": string,
        "LastModified": string,
        "ETag": string,
        "Size": number
    }[]
    "IsTruncated": boolean,
    "NextContinuationToken": string,
    "KeyCount": number,
    "MaxKeys": number,
    "Name": string,
    "Prefix": string
}

export type S3ObjectOutput = {
    "$metadata": {
        "httpStatusCode": number,
        "attempts": number,
        "totalRetryDelay": number
    },
    "AcceptRanges": "bytes",
    "LastModified": string,
    "ContentLength": number,
    "ChecksumCRC32C": string,
    "ETag": string,
    "CacheControl": string,
    "ContentType": string,
    "Expires": string,
    "ExpiresString": string
}

export const files = {
    object: async (key: string): Promise<S3ObjectOutput> => {
        const uris = await getUris();
        let url = `${uris.files}/s3/object`;
        const token = await getToken()
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({ key }),
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
        return response.json();
    },
    list: async ({search, continuationToken}: {search?: string, continuationToken?: string}): Promise<S3FileListOutput> => {
        const uris = await getUris();
        let url = `${uris.files}/s3/list`;
        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        if (search) {
            url += `?search=${search}`;
        }
        
        if (continuationToken) {
            url += `?continuationToken=${continuationToken}`;
        }

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
        return response.json();
    },
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
