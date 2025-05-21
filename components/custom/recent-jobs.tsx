import { useQuery } from "@apollo/client";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import {
  CheckCircle2,
  CircleDotDashed,
  CircleOff,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Avatar } from "@/components/ui//avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {GET_JOBS} from "@/queries/queries";
import {TruncatedText} from "@/components/truncated-text";
import {JOB_STATUS} from "@/util/enums/job-status";

export function RecentJobs({ statusses, agent, session, type }: { statusses: string, agent?: string, session?: string, type?: "workflow" | "embedder" }) {

  const filters: any = {}
  if (statusses) {
    if (!filters.AND) filters.AND = []
    filters.AND.push({
      OR: statusses.split(",")?.map( status => ({ status: status }))
    });
  }
  if (agent) {
    if (!filters.AND) filters.AND = []
    filters.AND.push({ agent: agent })
  }
  if (session) {
    if (!filters.AND) filters.AND = []
    filters.AND.push({ session: session })
  }
  if (type) {
    if (!filters.AND) filters.AND = []
    filters.AND.push({ type: type })
  }

  const { loading, error, data, refetch } = useQuery(GET_JOBS, {
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      limit: 3,
      page: 1,
      filters: filters
    },
    pollInterval: 5000, // polls every 5 seconds for updates on jobs
  });

  return loading ? (
    <div className="flex flex-col gap-2 pt-0">
      <Skeleton className="w-full h-[50px] rounded-lg mb-2" />
      <Skeleton className="w-full h-[50px] rounded-lg mb-2" />
      <Skeleton className="w-full h-[50px] rounded-lg" />
    </div>
  ) : (
    <div className="space-y-8">
      {data?.jobPagination?.items.length ? (
        data?.jobPagination?.items?.map(
          (
            job: {
              status: string;
              batch: string;
              id: string;
              trigger: string;
              action: string;
              name: string;
              createdAt: string;
              results: any;
              done: number;
              count: number;
            },
            index: number,
          ) => {
            return (
              <div key={index} className="flex items-center">
                <Avatar
                  className={cn(
                    "h-9 w-9",
                    job.status === JOB_STATUS.completed
                      ? "bg-green-500"
                      : job.status === JOB_STATUS.failed
                        ? "bg-red-500"
                        : (
                                job.status === JOB_STATUS.waiting ||
                                job.status === JOB_STATUS.delayed
                            )
                          ? "bg-blue-500"
                          : job.status === JOB_STATUS.paused
                            ? "bg-orange-500"
                            : "bg-gray-500",
                  )}
                >
                  {job.status === JOB_STATUS.completed && (
                    <CheckCircle2 className="m-auto" />
                  )}
                  {job.status === JOB_STATUS.failed && <XCircle className="m-auto" />}
                  {job.status === JOB_STATUS.stuck && <XCircle className="m-auto" />}

                  {(
                      job.status === JOB_STATUS.waiting ||
                      job.status === JOB_STATUS.paused
                  ) && (
                    <CircleDotDashed className="m-auto" />
                  )}
                  {job.status === JOB_STATUS.paused && (
                    <CircleOff className="m-auto" />
                  )}
                </Avatar>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {/* todo: link to a specific job */}
                    <Link
                      className="hover:dark:text-blue-500 hover:underline"
                      href={"/jobs/" + job.id}
                    >
                      <TruncatedText text={job.name} length={50}/> 
                    </Link>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="capitalize">{job.status}</span> - 
                    created at: {formatDistanceToNow(new Date(job.createdAt), {
                      addSuffix: true,
                    })}.
                  </p>
                </div>
              </div>
            );
          },
        )
      ) : (
        <div className="flex flex-col gap-2 pt-0">
          <p className="text-sm font-medium leading-none">No jobs.</p>
        </div>
      )}
      {data?.jobPagination?.items.length ? (
        <div className="flex">
          <Link
            className={cn(
              "mx-auto text-center text-sm font-medium leading-none hover:dark:text-blue-500 hover:underline",
            )}
            href={"/jobs"}
          >
            View all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
