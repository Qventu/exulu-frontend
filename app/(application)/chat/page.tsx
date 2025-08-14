import {Bot} from "lucide-react";
import * as React from "react";

export default function ChatEmptyPage() {
    return (
        <div className="m-auto">
            <div className="flex flex-col">
                <div className="mx-auto"><Bot className="h-20 w-20"/></div>
                <h2 className="text-center">Select an agent.</h2>
                <small className="text-center">Bleep bleep bloop...</small>
            </div>
        </div>
    )
}