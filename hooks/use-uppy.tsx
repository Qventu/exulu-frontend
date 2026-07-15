import { useEffect, useState, useContext } from "react";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { getToken } from "@/lib/api/client";
import { ConfigContext } from "@/components/shell/config-context";
import { extractS3KeyFromUrl } from "@/lib/s3/extract-key";

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
