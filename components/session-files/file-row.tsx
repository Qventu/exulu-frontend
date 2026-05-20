"use client";

import { Button } from "@/components/ui/button";
import {
    FileText,
    FileCode,
    FileImage,
    FileSpreadsheet,
    FileType2,
    File as FileIcon,
    Eye,
    Download,
    Trash2,
} from "lucide-react";
import type { SessionFile } from "@/util/api";
import { formatBytes, formatRelativeTime, getPreviewCategory } from "./utils";

function IconFor({ name }: { name: string }) {
    const cat = getPreviewCategory(name);
    switch (cat) {
        case "text":
            return <FileText className="h-4 w-4 text-muted-foreground" />;
        case "code":
            return <FileCode className="h-4 w-4 text-muted-foreground" />;
        case "image":
            return <FileImage className="h-4 w-4 text-muted-foreground" />;
        case "pdf":
            return <FileType2 className="h-4 w-4 text-muted-foreground" />;
        case "office":
            return <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />;
        default:
            return <FileIcon className="h-4 w-4 text-muted-foreground" />;
    }
}

export function FileRow({
    file,
    onPreview,
    onDelete,
}: {
    file: SessionFile;
    onPreview: (file: SessionFile) => void;
    onDelete: (file: SessionFile) => void;
}) {
    return (
        <div className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/50 border-b last:border-b-0">
            <IconFor name={file.name} />
            <button
                type="button"
                onClick={() => onPreview(file)}
                className="flex-1 min-w-0 text-left"
            >
                <div className="text-sm font-medium truncate">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                    {formatBytes(file.size)} · {formatRelativeTime(file.lastModified)}
                </div>
            </button>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onPreview(file)}
                    title="Preview"
                >
                    <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                    title="Download"
                >
                    <a href={file.presignedUrl} download={file.name}>
                        <Download className="h-3.5 w-3.5" />
                    </a>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(file)}
                    title="Delete"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
