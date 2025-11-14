import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Response } from '@/components/ai-elements/response';

import {
    Artifact,
    ArtifactAction,
    ArtifactActions,
    ArtifactContent,
    ArtifactHeader,
} from '@/components/ai-elements/artifact';
import { CopyIcon, InfoIcon } from "lucide-react";

export function TextPreview({
    text,
    sliceLength
}: {
    text: string;
    sliceLength?: number;
}) {
    const { toast } = useToast();

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="cursor-pointer text-sm text-left w-full hover:bg-accent/50 transition-colors rounded-md p-2 group">
                    <span className="block">
                        {text?.slice(0, sliceLength ?? 200)}
                        {(sliceLength && text.length > sliceLength) ? "..." : ""}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1 group-hover:text-foreground transition-colors">
                        <InfoIcon className="w-3 h-3" />
                        Click to view full text
                    </span>
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[500px] overflow-y-scroll">
                <Artifact>
                    <ArtifactHeader>
                        <ArtifactActions>
                            <ArtifactAction icon={CopyIcon} label="Copy" tooltip="Copy to clipboard" onClick={async () => {
                                await navigator.clipboard.writeText(text);
                                toast({ title: "Copied to clipboard" });
                            }} />
                        </ArtifactActions>
                    </ArtifactHeader>
                    <ArtifactContent>
                        <Response>{text}</Response>
                    </ArtifactContent>
                </Artifact>
            </DialogContent>
        </Dialog>
    );
}
