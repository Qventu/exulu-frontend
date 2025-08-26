"use client"

import * as React from "react";
import { DataList } from "@/app/(application)/data/components/data-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Tabs } from "@/components/ui/tabs";
import {
    TooltipProvider,
} from "@/components/ui/tooltip";
import Contexts from "@/app/(application)/data/[[...query]]/contexts";

export default function DataLayout({ children, params }: { children: any, params: { query }; }) {

    const defaultLayout = [265, 440, 655];
    const navCollapsedSize = 4;
    const archived = params.query && params.query[1] === "archived";
    const settings = params.query && params.query[1] === "settings";
    const context = params.query && params.query[0];
    let item = null;
    if (params.query && archived) {
        item = params.query[2] || null;
    } else if (params.query && !settings) {
        item = params.query[1] || null;
    }

    return (
        <TooltipProvider delayDuration={0}>
            <ResizablePanelGroup
                direction="horizontal"
                onLayout={(sizes: number[]) => {
                    document.cookie = `react-resizable-panels:layout=${JSON.stringify(
                        sizes,
                    )}`;
                }}
                className="h-full items-stretch">
                <ResizablePanel
                    defaultSize={defaultLayout[0]}
                    collapsedSize={navCollapsedSize}
                    collapsible={true}
                    minSize={15}
                    maxSize={20}>
                    <Separator />
                    <Contexts activeFolder={context} activeArchived={archived} activeSettings={settings} />
                    <Separator />
                    <div className="p-3 opacity-50">
                        <Alert variant="default">
                            <Badge className="mb-2" variant={"secondary"}>
                                coming soon
                            </Badge>
                            <AlertTitle>Custom views</AlertTitle>
                            <AlertDescription>
                                Will enable you to store filter settings.
                            </AlertDescription>
                        </Alert>
                    </div>
                </ResizablePanel>

                {
                    context && !settings && <>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
                            <Tabs defaultValue="all">
                                <div className="flex items-center px-4 py-2 h-full">
                                    <h1 className="text-xl font-bold">Items</h1>
                                </div>
                                <Separator />
                                <DataList
                                    activeFolder={context}
                                    activeItem={item ?? undefined}
                                    archived={archived}
                                />
                            </Tabs>
                        </ResizablePanel>
                    </>
                }
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={defaultLayout[2]}>
                    <div className="max-h-full overflow-y-auto">
                        {children}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </TooltipProvider>
    );
}