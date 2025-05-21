"use client";

import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Row } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import {jobSchema} from "../data/schema";
import {useMutation} from "@tanstack/react-query";
import {JOB_STATUS} from "@/util/enums/job-status";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const job = jobSchema.parse(row.original);

  const { toast } = useToast();

  const cancelJob = useMutation({
    mutationFn: async (args: any) => {
      // todo
    }
  })

  const retryJob = useMutation({
    mutationFn: async (args: any) => {
      // todo
    }
  })

  const removeJob = useMutation({
    mutationFn: async (args: any) => {
      // todo
    }
  })

  const startJob = useMutation({
    mutationFn: async (args: any) => {
      // todo
    }
  })

  return (
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
        {
          job.status === JOB_STATUS.waiting ||
          job.status === JOB_STATUS.delayed ? (
          <DropdownMenuItem
            onClick={() => {
              cancelJob.mutate({
                id: job.id,
              });
              toast({
                title: "Cancelled job",
                description:
                  "We cancelled the job, note that if the job scheduler already started the job in the meantime it might still run.",
              });
            }}
          >
            Cancel job
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="opacity-50 cursor-not-allowed">
            Cancel job
          </DropdownMenuItem>
        )}

        {(
            job.status === JOB_STATUS.waiting ||
            job.status === JOB_STATUS.delayed
        ) && job.item ? (
          <DropdownMenuItem
            onClick={() => {
              startJob.mutate({
                id: job.id
              })
              toast({
                title: "Started job",
                description: "We manually started the job.",
              });
            }}
          >
            Force start
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="opacity-50 cursor-not-allowed">
            Force start
          </DropdownMenuItem>
        )}

        {job.status === JOB_STATUS.completed ||
        job.status === JOB_STATUS.failed ||
        job.status === JOB_STATUS.stuck ? (
          <DropdownMenuItem
            onClick={() => {
              retryJob.mutate({
                id: job.id,
              });
              toast({
                title: "Retrying job",
                description: "We scheduled the job to be run again.",
              });
            }}>
            Retry job
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="opacity-50 cursor-not-allowed">
            Retry job
          </DropdownMenuItem>
        )}
        {job.status === JOB_STATUS.completed ||
        job.status === JOB_STATUS.failed ||
        job.status === JOB_STATUS.stuck ? (
          <DropdownMenuItem
            onClick={() => {
              removeJob.mutate({
                id: job.id,
              });
              toast({
                title: "Deleting job",
                description: "We deleted the job.",
              });
            }}
          >
            Delete job
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="opacity-50 cursor-not-allowed">
            Delete job
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
