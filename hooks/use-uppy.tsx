import { useEffect, useState } from "react";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { getToken } from "@/util/api";

interface InitializeOptions {
    callbacks?: {
        uploadSuccess?: (response: {
            file: any | null;
            url: string
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
    if (!process.env.NEXT_PUBLIC_BACKEND) {
        throw new Error("No process.env.NEXT_PUBLIC_BACKEND set.")
    }
    const { callbacks, maxNumberOfFiles, uppyOptions } = options || {};
    const { uploadSuccess } = callbacks || {};
    const { allowedFileTypes, id } = uppyOptions || {};
    const token = await getToken()

    const uppy = new Uppy({
        autoProceed: true,
        debug: true,
        id: id || "uppy",
        restrictions: {
            maxNumberOfFiles: maxNumberOfFiles || 5,
            allowedFileTypes: allowedFileTypes || [".heic", ".jpg", ".jpeg", ".png", ".webp", ".svg"],
        },  
        ...uppyOptions,
    })
        .use(AwsS3, {
            id: "Exulu",
            endpoint: process.env.NEXT_PUBLIC_BACKEND,
            headers: {      
                Authorization: `Bearer ${token}`,
                Session: localStorage.getItem("session") ?? "",
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
                uploadSuccess({
                    file: file,
                    url: response.uploadURL,
                });
            }
        });

    return uppy;
};

function useUppy(options: InitializeOptions, deps: any[] = []) {
    const [uppy, setUppy] = useState<Uppy | undefined>(undefined);
    useEffect(() => {
        const initUppy = async () => {
            const uppyInstance = await initializeUppy(options);
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
