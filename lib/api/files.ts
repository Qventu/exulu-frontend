import { getToken, getUris } from "@/lib/api/client";

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

export const filesApi = {
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
    list: async ({ search, continuationToken, global }: { search?: string, continuationToken?: string, global?: boolean }): Promise<S3FileListOutput> => {
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
                ...(global && { Global: "true" }),
            },

        });
        return response.json();
    },
    // Key is the base s3 key of the file
    // if only the key is provided only the
    // user that uploaded the file, a super
    // admin or api user can access and
    // download the file. If an item ID is
    // provided, the RBAC rights associated
    // with the item are checked and used.
    // The item must be provided as a GID
    // with the context id as the prefix before
    // the first slash.
    download: async (key: string) => {

        const uris = await getUris();
        let url = `${uris.files}/s3/download?key=${encodeURIComponent(key)}`;

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
