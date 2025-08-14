"use client";

import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";

export function UploadActions({
  file,
  reload,
}: {
  reload: () => void;
  file: any;
}) {
  const { toast } = useToast();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex size-8 p-0 data-[state=open]:bg-muted"
          >
            <DotsHorizontalIcon className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          {/*<DropdownMenuItem onClick={() => {
                        console.log("");
                    }}>Preview file</DropdownMenuItem>*/}{" "}
          {/* todo */}
          {/*<DropdownMenuItem onClick={() => {
                        console.log("");
                    }}>Download file</DropdownMenuItem>*/}{" "}
          {/* todo */}
          {/*<DropdownMenuItem onClick={() => {
                        console.log("");
                    }}>Delete file</DropdownMenuItem>*/}{" "}
          {/* todo */}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
