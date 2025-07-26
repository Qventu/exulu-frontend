"use client"

import { useMutation, useQuery } from "@apollo/client";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { ChevronLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import {
  GET_JOBS,
  REMOVE_JOB_BY_ID,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent, TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { JobFilters } from "@/components/custom/recent-jobs";
import { Job } from "@/types/models/job";
import { JOB_STATUS } from "@/util/enums/job-status";

export function FlowSessionsComponent({ agent, type }: { agent: string, type: string }) {

  const pathname = usePathname();
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSessions, setShowSessions] = useState(true);
  const { user, setUser } = useContext(UserContext);

  useEffect(() => {
    const checkScreenWidth = () => {
      setIsMobile(window.innerWidth <= 1023);
    };

    // Initial check
    checkScreenWidth();

    // Event listener for screen width changes
    window.addEventListener("resize", checkScreenWidth);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener("resize", checkScreenWidth);
    };
  }, []);

  const router = useRouter();

  let [search, setSearch]: any = useState({ searchString: null });

  console.log("USER",user)

  let filters: JobFilters = {}
  filters["agent"] = { eq: agent }
  filters["type"] = { eq: "workflow" }
  filters["user"] = { eq: `${user.id}` }

  const jobsQuery = useQuery(GET_JOBS, {
    returnPartialData: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: 40, // todo pagination
      filters: filters
    },
  });

  const [removeSession, removeSessionResult] = useMutation(
    REMOVE_JOB_BY_ID,
    {
      refetchQueries: [
        GET_JOBS,
        "GetJobs",
      ],
    },
  );

  const handleCreateSession = async () => {
        router.push(
          `/playground/${agent}/${type}/new`,
        );
  }

  useEffect(() => {
    let variables: any = {
      page: 1,
      limit: 40,
    };
    if (search && search?.length > 2) {
      filters["name"] = { contains: search }
    } else {
      delete filters["name"];
    }
    jobsQuery.refetch(variables);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.altKey) && e.key === 'b') {
        setShowSessions(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {!showSessions && (
        <div
          onClick={() => setShowSessions(true)}
          className="relative hidden min-w-[10px] flex-col items-start md:flex h-100 overflow-y-scroll border-r flex hover:bg-muted cursor-pointer"
          x-chunk="dashboard-03-chunk-0"
        >
          <div className="m-auto rotate-90 flex">
            <span>
              Sessions
            </span>
          </div>
        </div>
      )}

      {showSessions && (
        <div
          className="md:min-w-[400px] relative hidden flex-col items-start md:flex h-100 overflow-y-scroll border-r"
          x-chunk="dashboard-03-chunk-0"
        >
          <div className="bg-background/95 w-full backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <form>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  onKeyUp={(e) => {
                    const searchString = e.currentTarget.value;
                    setSearch(searchString);
                  }}
                  placeholder="Search by name"
                  className="pl-8 border-0"
                />
              </div>
            </form>
          </div>

          <div className="flex w-full items-center gap-2 p-3 border-t justify-between">
            <Button
              variant="secondary"
              onClick={async () => {
                handleCreateSession();
              }}
            >
              <div className="font-semibold">New session</div>
            </Button>
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSessions(false)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Collapse (Ctrl+B)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {jobsQuery.loading && (
            <div className="w-full flex">
              <Loading className="mx-auto mt-5" />
            </div>
          )}


          {!jobsQuery.loading && !jobsQuery?.data?.jobsPagination?.items?.length && (
            <div className="w-full flex">
              <p className="mx-auto mt-5">No sessions found.</p>
            </div>
          )}

          {!jobsQuery.loading
            ? jobsQuery?.data?.jobsPagination?.items?.map(
              (
                job: Job,
              ) => (
                <div className="w-full p-2 flex flex-col items-start gap-0 rounded-none border-none text-left text-sm">
                <button
                  key={job.id}
                  className={cn(
                    "p-2 w-full flex flex-col items-start gap-2 rounded-md border-none p-3 text-left text-sm transition-all hover:bg-accent",
                    pathname.split("/").pop()?.includes(job.id) ? "bg-muted" : "",
                  )}
                  onClick={() => {
                    router.push(`/playground/${agent}/${type}/${job.id}`);
                  }}
                >
                  <div className="flex w-full flex-col gap-1">
                    <div className="flex items-center">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium">
                          {job.name
                            ? job.name?.substring(0, 50)
                            : "No title"}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "ml-auto text-xs",
                          pathname.includes(job.id)
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {job.updatedAt && !isCollapsed
                          ? formatDistanceToNow(
                            new Date(job.updatedAt),
                            {
                              addSuffix: true,
                            },
                          )
                          : null}
                      </div>

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
                        <DropdownMenuContent
                          align="end"
                          className="w-[160px]">
                          <DropdownMenuItem
                            disabled={
                              job.status !== JOB_STATUS.completed &&
                              job.status !== JOB_STATUS.failed
                            }
                            onClick={() => {
                              removeSession({
                                variables: {
                                  id: job.id,
                                },
                              });
                              toast({
                                title: "Deleting session",
                                description: "We deleted the session.",
                              });
                            }}>
                            Delete
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                              navigator.clipboard.writeText(job.id);
                              toast({
                                title: "Copied to clipboard",
                                description: "Copied the job id to clipboard.",
                              });
                            }}>
                            Copy job id
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <small className="text-xs text-muted-foreground">
                      {job.status}
                    </small>
                  </div>
                </button>
                </div>
              ),
            )
            : null}
        </div>
      )}
    </>
  );
}
