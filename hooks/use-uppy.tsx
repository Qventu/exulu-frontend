import { useEffect, useState, useContext } from "react";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { getToken } from "@/lib/api/client";
import { ConfigContext } from "@/components/config-context";

interface InitializeOptions {
    backend: string;
    global?: boolean;
    callbacks?: {
        uploadSuccess?: (response: {
            file: any | null;
            url: string;
            key: string;
            s3Key?: string;
        }) => void;
    };
    fileKey?: string;
    fileKeyPrefix?: string;
    maxNumberOfFiles?: number;
    uppyOptions?: {
        id?: string;
        allowedFileTypes: string[];
    };
    useName?: boolean;
}

function extractS3KeyFromUrl(uploadURL: string): string {
    try {
        const url = new URL(uploadURL);
        const hostname = url.hostname;
        // url.pathname is percent-encoded (spaces → %20, "–" → %E2%80%93, etc.).
        // Decode it so the stored s3Key is the raw object key — otherwise the
        // backend re-encodes it when presigning (%20 → %2520) and S3 404s on a
        // key that doesn't exist.
        const rawPath = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
        const keyPath = decodeURIComponent(rawPath);
        if (hostname.includes(".s3.") || hostname.includes(".s3-")) {
            const parts = hostname.split(/\.s3[.-]/);
            const bucket = parts[0];
            return `${bucket}/${keyPath}`;
        }
        return keyPath;
    } catch (e) {
        console.error("Failed to parse S3 upload URL:", e);
        return uploadURL.split("/").pop() || "";
    }
}

export const initializeUppy = async (options: InitializeOptions): Promise<Uppy> => {
    if (!options.backend) {
        throw new Error("No backend set.")
    }
    const { callbacks, maxNumberOfFiles, uppyOptions } = options || {};
    const { uploadSuccess } = callbacks || {};
    const { allowedFileTypes, id } = uppyOptions || {};
    const token = await getToken()

    const uppy = new Uppy({
        autoProceed: true,
        debug: false,
        id: id || "uppy",
        restrictions: {
            maxNumberOfFiles: maxNumberOfFiles || 5,
            allowedFileTypes: allowedFileTypes || [".heic", ".jpg", ".jpeg", ".png", ".webp", ".svg"],
        }
    })
        .use(AwsS3, {
            id: "Exulu",
            endpoint: options.backend,
            headers: {      
                Authorization: `Bearer ${token}`,
                Session: localStorage.getItem("session") ?? "",
                // This is used to determine if the file is being uploaded to a global directory
                // or a user's private directory. For example used when uploading agent animations.
                ...(options.global && { Global: "true" }),
            }
        })
        .on("file-added", async (file) => {
            console.debug("added", file);
        })
        .on("upload-error", (file, error) => {
            if (!file?.id) {
                return;
            }
            uppy.removeFile(file?.id);
            console.error("error", error);
        })
        .on("upload-success", (file, response) => {
            if (!response.uploadURL) {
                return;
            }
            if (uploadSuccess) {
                console.log("response", response)
                uploadSuccess({
                    file: file,
                    key: response.uploadURL.split("/").pop() || "",
                    s3Key: extractS3KeyFromUrl(response.uploadURL),
                    url: response.uploadURL,
                });
            }
        });

    return uppy;
};

function useUppy(options: InitializeOptions, deps: any[] = []) {
    const configContext = useContext(ConfigContext);
    const [uppy, setUppy] = useState<Uppy | undefined>(undefined);
    useEffect(() => {
        const initUppy = async () => {
            const uppyInstance = await initializeUppy({
                ...options,
                backend: configContext?.backend || "",
            });
            setUppy(uppyInstance);
        };
        initUppy()
        return () => {
            if (uppy) {
                uppy.destroy();
                setUppy(undefined);
            }
        };
    }, [...deps]);

    return uppy;
}

export default useUppy;
