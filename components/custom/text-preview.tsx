import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Response } from '@/components/ai-elements/response';
import { CopyIcon, DownloadIcon, InfoIcon } from "lucide-react";

const LARGE_TEXT_THRESHOLD = 50000; // Characters threshold for automatic download

export function TextPreview({
    text,
    sliceLength,
    metadata
}: {
    text?: string;
    sliceLength?: number;
    metadata?: Record<string, any>;
}) {
    const displayLength = sliceLength ?? 200;
    if (!text) {
        text = ""
    }
    const isTruncated = text.length > displayLength;
    const isVeryLarge = text.length > LARGE_TEXT_THRESHOLD;

    const downloadAsFile = () => {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `text-content-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Downloaded as .txt file");
    };

    if (isVeryLarge) {
        return (
            <button
                onClick={downloadAsFile}
                className="cursor-pointer text-sm text-left w-full hover:bg-accent/70 active:bg-accent transition-all rounded-lg p-3 group border border-transparent hover:border-border hover:shadow-sm"
            >
                <span className="block leading-relaxed text-foreground/90 group-hover:text-foreground transition-colors">
                    {text?.slice(0, displayLength)}
                    <span className="text-muted-foreground">...</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 group-hover:text-foreground/70 transition-colors font-medium">
                    <DownloadIcon className="w-3.5 h-3.5" />
                    Click to download as .txt file ({text.length.toLocaleString()} characters)
                </span>
            </button>
        );
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="cursor-pointer text-sm text-left w-full hover:bg-accent/70 active:bg-accent transition-all rounded-lg p-3 group border border-transparent hover:border-border hover:shadow-sm">
                    <span className="block leading-relaxed text-foreground/90 group-hover:text-foreground transition-colors">
                        {text?.slice(0, displayLength)}
                        {isTruncated && <span className="text-muted-foreground">...</span>}
                    </span>
                    {isTruncated && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 group-hover:text-foreground/70 transition-colors font-medium">
                            <InfoIcon className="w-3.5 h-3.5" />
                            Click to view full text ({text.length.toLocaleString()} characters)
                        </span>
                    )}
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] max-h-[600px] flex flex-col">
                <div className="flex items-center justify-between mt-5">
                    <div className="text-sm font-medium text-muted-foreground">
                        {text.length.toLocaleString()} characters
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer" onClick={async () => {
                        await navigator.clipboard.writeText(text);
                        toast.success("Copied to clipboard");
                    }}>
                        <span className="text-muted-foreground">Copy value to clipboard</span>
                        <CopyIcon className="size-4" />
                    </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-4 bg-muted max-h-[100%] overflow-y-auto">
                    <Response>{text}</Response>
                </div>
                {metadata && (
                    <div className="mt-4">
                        {/* Table, by iterating through the metadata keys and values */}
                        <table className="w-full border-collapse border border-border text-xs text-muted-foreground">
                            <thead>
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold border-b border-border bg-muted/50">Key</th>
                                    <th className="px-4 py-2 text-left font-semibold border-b border-border bg-muted/50">Value</th>
                                </tr>
                            </thead>
                        </table>
                            <tbody>
                                {Object.entries(metadata).map(([key, value]) => (
                                    <tr key={key}>
                                        <td className="px-4 py-2">{key}</td>
                                        <td className="px-4 py-2">{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
