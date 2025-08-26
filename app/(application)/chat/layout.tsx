"use client";

import {AgentNav} from "@/components/agent-nav";
import * as React from "react";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-full">
            <div className="border-r bg-muted/10">
                <AgentNav/>
            </div>
            {children}
        </div>
    );
}
