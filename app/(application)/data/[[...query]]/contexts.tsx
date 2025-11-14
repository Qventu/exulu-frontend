"use client"

import * as React from "react";
import { Folder, LucideIcon, Loader, Pencil, ArrowLeft, ListChecksIcon, ArchiveX, Database, FileStack } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useContexts } from "@/hooks/contexts";
import Link from "next/link";
import { cn } from "@/lib/utils";
export type FolderFieldType = "text" | "longText" | "shortText" | "number" | "boolean" | "code" | "json";

export type FolderType = {
    id?: string;
    label: string;
    fields?: {
        type: FolderFieldType;
        name: string;
    }[];
    active?: boolean;
    icon: LucideIcon;
    href?: string;
    variant: "default" | "ghost";
}

const ContextLink = ({ index, folder, edit, indented, children }: { index: number, folder: FolderType, edit?: () => void, indented?: boolean, children?: React.ReactNode }) => {
    return (
        <div className="flex flex-col   ">
            <div className={cn(
                buttonVariants({ variant: folder.variant, size: "sm" }),
                indented ? "pl-5" : null,
                folder.active ?
                    "dark:bg-muted dark:text-white dark:hover:bg-muted dark:hover:text-white" : null,
                "justify-start",
            )}>
                <Link
                    className="flex"
                    key={index}
                    href={folder.href || ""}>
                    <folder.icon className="mr-2 size-4" />
                    {
                        !folder.icon && folder.label
                    }
                    {folder.icon !== null && (
                        <span
                            className={cn(
                                "ml-0 overflow-hidden text-ellipsis max-w-[170px]",
                                folder.variant === "default" &&
                                "text-background dark:text-white",
                            )}>
                            {folder.label}
                        </span>
                    )}
                </Link>
                {edit && <Pencil onClick={() => {
                    edit()
                }} className="ml-auto size-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                }
            </div>
            <div>
                {children}
            </div>
        </div>
    )
}

const Contexts = ({ activeFolder, activeArchived, activeSources, activeEmbeddings }: { activeFolder: string, activeArchived: boolean, activeSources: boolean, activeEmbeddings: boolean }) => {

    const { data, loading, error } = useContexts();

    return (<>
        <div key={activeFolder + activeArchived + activeSources + activeEmbeddings} className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2 pb-5">

            {
                activeFolder ? <div className="flex items-center gap-2">
                    <Button variant="link" size="sm" asChild>
                        <Link href="/data">
                            <ArrowLeft className="size-4" />
                            <span className="ml-2">Back to dashboard</span>
                        </Link>
                    </Button>
                </div> : <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground ml-5 pt-3">Select a context:</span>
                </div>
            }
            <nav
                className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
                {
                    loading ? <ContextLink index={111} folder={{
                        label: `Loading...`,
                        active: false,
                        icon: Loader,
                        variant: "ghost"
                    }} /> : data?.contexts?.items.map((folder, index) => {
                        return (<ContextLink key={folder.id} index={index} folder={{
                            label: `${folder.name}`,
                            icon: Folder,
                            variant: "ghost",
                            href: `/data/${folder.id}`,
                        }}>
                            {
                                activeFolder?.toLowerCase() === `${folder.id}`.toLowerCase() &&
                                <>
                                    <ContextLink index={index} indented={true} folder={{
                                        label: "Active data",
                                        active: activeFolder?.toLowerCase() === `${folder.id}`.toLowerCase() && !activeArchived && !activeSources && !activeEmbeddings,
                                        icon: ListChecksIcon,
                                        variant: activeFolder?.toLowerCase() === `${folder.id}`.toLowerCase() && !activeArchived && !activeSources && !activeEmbeddings ? "default" : "ghost",
                                        href: `/data/${folder.id}`,
                                    }}></ContextLink>
                                    <ContextLink index={index + 1000} indented={true} folder={{
                                        label: `Archived data`,
                                        active: activeArchived,
                                        icon: ArchiveX,
                                        variant: activeArchived ? "default" : "ghost",
                                        href: `/data/${folder.id}/archived`,
                                    }} />
                                    <ContextLink index={index + 1000} indented={true} folder={{
                                        label: `Sources`,
                                        active: activeSources,
                                        icon: Database,
                                        variant: activeSources ? "default" : "ghost",
                                        href: `/data/${folder.id}/sources`,
                                    }} />
                                    <ContextLink index={index + 1000} indented={true} folder={{
                                        label: `Embeddings`,
                                        active: activeEmbeddings,
                                        icon: FileStack,
                                        variant: activeEmbeddings ? "default" : "ghost",
                                        href: `/data/${folder.id}/embeddings`,
                                    }} />
                                </>
                            }

                        </ContextLink>)
                    })
                }
            </nav>
        </div>
    </>)
}

export default Contexts;