import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function TextPreview({
    text,
    sliceLength,
    markdown
}: {
    text: string;
    sliceLength?: number;
    markdown?: boolean;
}) {
    const { toast } = useToast();

    return (
        <Dialog>
            <DialogTrigger asChild>
                <p className="cursor-pointer text-sm text-base">
                    {text?.slice(0, sliceLength ?? 200)}{(sliceLength && text.length > sliceLength) ? "..." : ""}
                </p>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[500px] overflow-y-scroll">
                <DialogHeader>
                    <DialogTitle>Text</DialogTitle>
                    <DialogDescription
                        className="cursor-copy"
                        onClick={async () => {
                            await navigator.clipboard.writeText(text);
                            toast({ title: "Copied to clipboard" });
                        }}
                    >
                        {markdown ? <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown> : text}
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}
