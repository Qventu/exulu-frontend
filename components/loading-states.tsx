import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LoadingStatesVariant =
    | "create"
    | "create-with-processor"
    | "save"
    | "process"
    | "delete"
    | "generate-chunks"
    | "delete-chunks";

const VARIANTS: Record<LoadingStatesVariant, { states: string[]; subtitle: string }> = {
    "create": {
        states: ["Creating item...", "Saving data...", "Almost done..."],
        subtitle: "Saving your new item...",
    },
    "create-with-processor": {
        states: ["Creating item...", "Processing fields...", "Preparing for AI...", "Almost done..."],
        subtitle: "Your item is being processed. This may take a moment.",
    },
    "save": {
        states: ["Saving changes...", "Updating fields...", "Almost done..."],
        subtitle: "Updating your item...",
    },
    "process": {
        states: ["Processing item...", "Running processor...", "Almost done..."],
        subtitle: "The processor is running on your item.",
    },
    "delete": {
        states: ["Deleting item...", "Cleaning up...", "Almost done..."],
        subtitle: "Removing your item...",
    },
    "generate-chunks": {
        states: ["Generating embeddings...", "Indexing chunks...", "Almost done..."],
        subtitle: "Creating embedding vectors for this item.",
    },
    "delete-chunks": {
        states: ["Deleting chunks...", "Cleaning up...", "Almost done..."],
        subtitle: "Removing chunks for this item.",
    },
};

export function LoadingStates({ variant }: { variant: LoadingStatesVariant }) {
    const { states, subtitle } = VARIANTS[variant];
    const [currentStateIndex, setCurrentStateIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStateIndex((prev) => (prev + 1) % states.length);
        }, 1500);

        return () => clearInterval(interval);
    }, [states.length]);

    return (
        <div className="flex flex-col items-center space-y-6 py-6">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <div className="space-y-3 text-center">
                <h3 className="text-xl font-semibold">{states[currentStateIndex]}</h3>
                <p className="text-sm text-muted-foreground px-4">{subtitle}</p>
            </div>
            <div className="flex space-x-2 pt-2">
                {states.map((_, index) => (
                    <div
                        key={index}
                        className={cn(
                            "h-2 rounded-full transition-all duration-300",
                            index === currentStateIndex
                                ? "bg-primary w-8"
                                : "bg-muted-foreground/30 w-2",
                        )}
                    />
                ))}
            </div>
        </div>
    );
}
