"use client";

import { ProjectNav } from "@/components/project-nav";
import * as React from "react";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-full">
            <div className="border-r bg-muted/10">
                <ProjectNav />
            </div>
            {children}
        </div>
    );
}