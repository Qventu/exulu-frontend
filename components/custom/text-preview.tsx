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
import { CopyIcon } from "lucide-react";

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
                <p className="cursor-pointer text-sm text-base">
                    {text?.slice(0, sliceLength ?? 200)}{(sliceLength && text.length > sliceLength) ? "..." : ""}
                </p>
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
