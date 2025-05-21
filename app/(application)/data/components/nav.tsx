"use client";

import { LucideIcon } from "lucide-react";
import Link from "next/link";
import {buttonVariants} from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as React from "react";

interface NavProps {
  links: {
    title: string;
    label?: number | string | null;
    active?: boolean;
    id?: string
    icon: LucideIcon;
    href: string;
    variant: "default" | "ghost";
  }[];
}

export function Nav({ links }: NavProps) {
  return (
    <div
      className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2"
    >
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
        {links.map((link, index) =>
            <Link
                key={index}
                href={link.href}
                className={cn(
                    buttonVariants({ variant: link.variant, size: "sm" }),
                    link.active ?
                        "dark:bg-muted dark:text-white dark:hover:bg-muted dark:hover:text-white" : null,
                    "justify-start",
                )}
            >
              <link.icon className="mr-2 size-4" />
              {link.title}
              {link.label !== null && (
                  <span
                      className={cn(
                          "ml-auto",
                          link.variant === "default" &&
                          "text-background dark:text-white",
                      )}
                  >
                  {link.label}
                </span>
              )}
            </Link>
        )}
      </nav>
    </div>
  );
}
