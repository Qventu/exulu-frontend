"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_QUEUE, GET_JOBS, DELETE_JOB, PAUSE_QUEUE, DRAIN_QUEUE, RESUME_QUEUE } from "@/queries/queries";
import { QueueJob } from "@/types/models/job";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Pause, Droplet, Play, RefreshCcw, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { TextPreview } from "@/components/custom/text-preview";
import { DoubleArrowLeftIcon } from "@radix-ui/react-icons";
import { JobStatus } from "@/types/models/job-result";

interface QueueManagementProps {
  queueName: string;
  nameGenerator: (job: QueueJob) => string;
  retryJob: (job: QueueJob) => void;
}

export function QueueManagement({ queueName, nameGenerator, retryJob }: QueueManagementProps) {
  const { toast } = useToast();
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [drainDialogOpen, setDrainDialogOpen] = useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [jobsToDelete, setJobsToDelete] = useState<QueueJob[]>([]);
  const [jobsToRetry, setJobsToRetry] = useState<QueueJob[]>([]);
  const [deleteOriginalJob, setDeleteOriginalJob] = useState(false);
  const [status, setStatus] = useState<JobStatus>("completed");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  const { data: queueData, loading: loadingQueue, refetch: refetchQueue } = useQuery(GET_QUEUE, {
    variables: { queue: queueName },
    pollInterval: 5000, // Poll every 5 seconds
  });

  const { data: jobsData, loading: loadingJobs, refetch: refetchJobs, networkStatus: jobsNetworkStatus } = useQuery(GET_JOBS, {
    variables: {
      queue: queueName,
      statusses: status,
      page: page,
      limit: limit
    },
    pollInterval: 5000, // Poll every 5 seconds
  });

  const [deleteJob, { loading: deletingJob }] = useMutation(DELETE_JOB, {
    onError: (error) => {
      toast({
        title: "Failed to delete job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [pauseQueue, { loading: pausingQueue }] = useMutation(PAUSE_QUEUE, {
    onCompleted: () => {
      toast({
        title: "Queue paused",
        description: `The ${queueName} queue has been paused.`,
      });
      refetchQueue();
      setPauseDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to pause queue",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [resumeQueue, { loading: resumingQueue }] = useMutation(RESUME_QUEUE, {
    onCompleted: () => {
      toast({
        title: "Queue resumed",
        description: `The ${queueName} queue has been resumed.`,
      });
      refetchQueue();
      setResumeDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to resume queue",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [drainQueue, { loading: drainingQueue }] = useMutation(DRAIN_QUEUE, {
    onCompleted: () => {
      toast({
        title: "Queue drained",
        description: "All waiting and delayed jobs have been removed from the queue.",
      });
      refetchQueue();
      refetchJobs();
      setDrainDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to drain queue",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteJob = (job: QueueJob) => {
    setJobsToDelete([job]);
  };

  const handleBulkDelete = () => {
    const jobsToDeleteArray = jobs.items.filter(job => selectedJobs.has(job.id));
    setJobsToDelete(jobsToDeleteArray);
  };

  const handleBulkRetry = () => {
    const jobsToRetryArray = jobs.items.filter(job => selectedJobs.has(job.id));
    setJobsToRetry(jobsToRetryArray);
  };

  const handleRetryJob = (job: QueueJob) => {
    setJobsToRetry([job]);
  };

  const toggleJobSelection = (jobId: string) => {
    const newSelection = new Set(selectedJobs);
    if (newSelection.has(jobId)) {
      newSelection.delete(jobId);
    } else {
      newSelection.add(jobId);
    }
    setSelectedJobs(newSelection);
  };

  const toggleAllJobs = () => {
    // Filter out active jobs since they can't be deleted
    const selectableJobs = jobs.items.filter(job => job.state !== "active");
    if (selectedJobs.size === selectableJobs.length && selectableJobs.length > 0) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(selectableJobs.map(job => job.id)));
    }
  };

  const confirmDeleteJobs = async () => {
    const jobsWithoutId = jobsToDelete.filter(job => !job.id);
    if (jobsWithoutId.length > 0) {
      toast({
        title: "Failed to delete jobs",
        description: "Some jobs have no ID.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Delete all jobs in parallel
      await Promise.all(
        jobsToDelete.map(job =>
          deleteJob({
            variables: {
              queue: queueName,
              id: job.id,
            },
          })
        )
      );

      toast({
        title: jobsToDelete.length === 1 ? "Job deleted" : "Jobs deleted",
        description: `Successfully deleted ${jobsToDelete.length} job${jobsToDelete.length === 1 ? '' : 's'}.`,
      });

      refetchJobs();
      refetchQueue();
      setJobsToDelete([]);
      setSelectedJobs(new Set());
    } catch (error) {
      // Error toast already handled by mutation onError
    }
  };

  const handlePauseQueue = () => {
    pauseQueue({
      variables: { queue: queueName },
    });
  };

  const handleResumeQueue = () => {
    resumeQueue({
      variables: { queue: queueName },
    });
  };

  const handleDrainQueue = () => {
    drainQueue({
      variables: { queue: queueName },
    });
  };

  const queue = queueData?.queue;
  const jobs: {
    items: QueueJob[],
    pageInfo: {
      pageCount: number,
      itemCount: number,
      currentPage: number,
      hasPreviousPage: boolean,
      hasNextPage: boolean,
    }
  } = jobsData?.jobs || {
    items: [],
    pageInfo: {
      pageCount: 0,
      itemCount: 0,
      currentPage: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    }
  };

  const getStatusBadge = (state: string) => {
    const statusColors: Record<string, string> = {
      active: "bg-blue-100 text-blue-800 border-blue-200",
      waiting: "bg-yellow-100 text-yellow-800 border-yellow-200",
      completed: "bg-green-100 text-green-800 border-green-200",
      failed: "bg-red-100 text-red-800 border-red-200",
      delayed: "bg-orange-100 text-orange-800 border-orange-200",
      paused: "bg-gray-100 text-gray-800 border-gray-200",
    };

    return (
      <Badge variant="outline" className={statusColors[state] || "bg-gray-100 text-gray-800"}>
        {state}
      </Badge>
    );
  };

  if (loadingQueue && loadingJobs) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle>Queue: {queueName}</CardTitle>
                <CardDescription>Manage the {queueName} job queue and view all jobs.</CardDescription>
              </div>
            </div>
            {queue && <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => queue?.isPaused ? setResumeDialogOpen(true) : setPauseDialogOpen(true)}
                disabled={pausingQueue || resumingQueue}
              >
                {queue?.isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                {queue?.isPaused ? "Resume queue" : "Pause queue"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setDrainDialogOpen(true)}
                disabled={drainingQueue}
              >
                <Droplet className="mr-2 h-4 w-4" />
                Drain queue
              </Button>
            </div>}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Queue Stats */}
          {queue && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">Status:</div>
                    <div>
                      {queue.isPaused ? (
                        <Badge variant="outline" className="bg-gray-100 text-gray-800">
                          Paused
                        </Badge>
                      ) : queue.isMaxed ? (
                        <Badge variant="outline" className="bg-red-100 text-red-800">
                          Maxed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-1">
                      <div className="text-xs text-muted-foreground">Max Queue Concurrency</div>
                      <div className="text-sm font-semibold">{queue.concurrency?.queue || "None"}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-xs text-muted-foreground">Max Worker Concurrency</div>
                      <div className="text-sm font-semibold">{queue.concurrency?.worker || "None"}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-xs text-muted-foreground">Job Timeout</div>
                      <div className="text-sm font-semibold">{queue.timeoutInSeconds || "None"}s</div>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-muted-foreground">Max Rate Limit</div>
                    <div className="text-sm font-semibold">{queue.ratelimit || "None"} jobs/sec</div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <Tabs value={status} onValueChange={(value) => setStatus(value as JobStatus)} className="w-auto">
                    <TabsList>
                      <TabsTrigger value="active" className="gap-1.5">
                        <span>Active</span>
                        <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-600 border-blue-200">
                          {queue.jobs?.active || 0}
                        </Badge>
                      </TabsTrigger>
                      <TabsTrigger value="waiting" className="gap-1.5">
                        <span>Waiting</span>
                        <Badge variant="secondary" className="ml-1 bg-yellow-100 text-yellow-600 border-yellow-200">
                          {queue.jobs?.waiting || 0}
                        </Badge>
                      </TabsTrigger>
                      <TabsTrigger value="failed" className="gap-1.5">
                        <span>Failed</span>
                        <Badge variant="secondary" className="ml-1 bg-red-100 text-red-600 border-red-200">
                          {queue.jobs?.failed || 0}
                        </Badge>
                      </TabsTrigger>
                      <TabsTrigger value="stuck" className="gap-1.5">
                        <span>Stuck</span>
                        <Badge variant="secondary" className="ml-1 bg-red-100 text-red-600 border-red-200">
                          {queue.jobs?.stuck || 0}
                        </Badge>
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="gap-1.5">
                        <span>Completed</span>
                        <Badge variant="secondary" className="ml-1 bg-green-100 text-green-600 border-green-200">
                          {queue.jobs?.completed || 0}
                        </Badge>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <span className="text-xs text-muted-foreground">* Only last 5.000 succesfull and failed jobs are kept.</span>
                </div>
              </div>
            </div>
          )}

          {/* Jobs Table */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Queue Jobs</h3>
                <p className="text-xs text-muted-foreground">All jobs currently in the {queueName} queue</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Show</p>
                  <Select
                    value={`${limit}`}
                    onValueChange={(value) => {
                      setLimit(Number(value));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={limit} />
                    </SelectTrigger>
                    <SelectContent side="bottom">
                      {[20, 50, 100, 200].map((pageSize) => (
                        <SelectItem key={pageSize} value={`${pageSize}`}>
                          {pageSize}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedJobs.size > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkRetry}
                      disabled={deletingJob}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Retry {selectedJobs.size} job{selectedJobs.size === 1 ? '' : 's'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={deletingJob}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete {selectedJobs.size} job{selectedJobs.size === 1 ? '' : 's'}
                    </Button>
                  </>
                )}
                <Badge variant="outline">
                  Auto Refresh: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />
                </Badge>
              </div>
            </div>
            <div className="border rounded-lg">
              {loadingJobs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : jobs.items?.length === 0 ? (
                <div className="text-center pt-8 text-muted-foreground">
                  No jobs in queue
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            jobs.items.filter(job => job.state !== "active").length > 0 &&
                            selectedJobs.size === jobs.items.filter(job => job.state !== "active").length
                          }
                          onCheckedChange={toggleAllJobs}
                          aria-label="Select all jobs"
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>ID</TableHead>
                      {/* <TableHead>State</TableHead> */}
                      <TableHead>Attempts</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Processed On</TableHead>
                      <TableHead>Finished On</TableHead>
                      <TableHead>Inputs</TableHead>
                      <TableHead>Outputs</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.items?.map((job, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Checkbox
                            checked={selectedJobs.has(job.id)}
                            onCheckedChange={() => toggleJobSelection(job.id)}
                            disabled={job.state === "active"}
                            aria-label={`Select job ${nameGenerator(job)}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {nameGenerator(job)}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span onClick={() => {
                                navigator.clipboard.writeText(job.id);
                                toast({
                                  title: "Copied to clipboard",
                                  description: `The job ID: "${job.id}" was copied to your clipboard.`,
                                });
                              }} className="max-w-[120px] truncate cursor-copy">
                                {job.id}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Job ID: {job.id}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        {/* <TableCell>{getStatusBadge(job.state)}</TableCell> */}
                        <TableCell>
                          {job.attemptsMade}
                        </TableCell>
                        <TableCell>
                          {job.timestamp ? format(new Date(job.timestamp), "MMM d, yyyy HH:mm:ss") : "N/A"}
                        </TableCell>
                        <TableCell>
                          {job.processedOn ? format(new Date(job.processedOn), "MMM d, yyyy HH:mm:ss") : "N/A"}
                        </TableCell>
                        <TableCell>
                          {job.finishedOn ? format(new Date(job.finishedOn), "MMM d, yyyy HH:mm:ss") : "N/A"}
                        </TableCell>
                        <TableCell>
                          {job.data ? (
                            <div className="text-xs text-muted-foreground max-w-[120px] truncate">
                              <TextPreview
                                sliceLength={50}
                                text={JSON.stringify(job.data)}
                              />
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {job.failedReason ? (
                            <div className="text-xs text-red-600 max-w-[120px] truncate">
                              <TextPreview
                                sliceLength={50}
                                text={"Error: " + job.failedReason}
                              />
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground max-w-[120px] truncate">
                              <TextPreview
                                sliceLength={50}
                                text={JSON.stringify(job.returnvalue)}
                              />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {job.state !== "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteJob(job)}
                              disabled={deletingJob}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                          {job.state === "failed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRetryJob(job)}>
                              <RefreshCcw className="h-4 w-4 text-blue-600" />
                              Retry
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex-1 text-sm text-muted-foreground">
                  ({jobs?.pageInfo?.itemCount || 0} total{" "}items).
                </div>
                <div className="flex items-center space-x-6 lg:space-x-8">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      className="hidden size-8 p-0 lg:flex"
                      onClick={() => {
                        setPage(1);
                        refetchJobs();
                      }}
                      disabled={!jobs?.pageInfo?.hasPreviousPage}
                    >
                      <span className="sr-only">Go to first page</span>
                      <DoubleArrowLeftIcon className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="size-8 p-0"
                      onClick={() => {
                        setPage(jobs?.pageInfo?.hasPreviousPage ? jobs?.pageInfo?.currentPage - 1 : 1);
                        refetchJobs();
                      }}
                      disabled={!jobs?.pageInfo?.hasPreviousPage}
                    >
                      <span className="sr-only">Go to previous page</span>
                      <ChevronLeftIcon className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="size-8 p-0"
                      onClick={() => {
                        setPage(jobs?.pageInfo?.hasNextPage ? jobs?.pageInfo?.currentPage + 1 : 1);
                        refetchJobs();
                      }}
                      disabled={!jobs?.pageInfo.hasNextPage}>
                      <span className="sr-only">Go to next page</span>
                      <ChevronRightIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Job(s) Confirmation Dialog */}
      <AlertDialog open={jobsToDelete.length > 0} onOpenChange={(open) => !open && setJobsToDelete([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {jobsToDelete.length === 1 ? "Delete Job?" : `Delete ${jobsToDelete.length} Jobs?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {jobsToDelete.length === 1
                ? `Are you sure you want to delete the job "${jobsToDelete[0]?.name}"? This action cannot be undone.`
                : `Are you sure you want to delete ${jobsToDelete.length} jobs? This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteJobs} disabled={deletingJob}>
              {deletingJob && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retry Jobs Confirmation Dialog */}
      <AlertDialog open={jobsToRetry.length > 0} onOpenChange={(open) => {
        if (!open) {
          setJobsToRetry([]);
          setDeleteOriginalJob(false);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {jobsToRetry.length === 1 ? "Retry Job?" : `Retry ${jobsToRetry.length} Jobs?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {jobsToRetry.length === 1
                ? "This will create a new job (not overwrite the current one) with the same inputs as the original job. Are you sure you want to continue?"
                : `This will create ${jobsToRetry.length} new jobs (not overwrite the current ones) with the same inputs as the original jobs. Are you sure you want to continue?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <Checkbox
              id="delete-original-bulk"
              checked={deleteOriginalJob}
              onCheckedChange={(checked) => setDeleteOriginalJob(checked as boolean)}
            />
            <label
              htmlFor="delete-original-bulk"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Delete the original {jobsToRetry.length === 1 ? 'job' : 'jobs'} after retrying
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              // Retry all jobs
              for (const job of jobsToRetry) {
                retryJob(job);
              }

              // Delete original jobs if checkbox is checked
              if (deleteOriginalJob) {
                try {
                  await Promise.all(
                    jobsToRetry
                      .filter(job => job.id)
                      .map(job =>
                        deleteJob({
                          variables: {
                            queue: queueName,
                            id: job.id,
                          },
                        })
                      )
                  );

                  toast({
                    title: jobsToRetry.length === 1 ? "Job deleted" : "Jobs deleted",
                    description: `Successfully deleted ${jobsToRetry.length} original job${jobsToRetry.length === 1 ? '' : 's'}.`,
                  });
                  refetchJobs();
                  refetchQueue();
                } catch (error) {
                  // Error toast already handled by mutation onError
                }
              }

              toast({
                title: jobsToRetry.length === 1 ? "Job retried" : "Jobs retried",
                description: `Successfully retried ${jobsToRetry.length} job${jobsToRetry.length === 1 ? '' : 's'}.`,
              });

              setJobsToRetry([]);
              setDeleteOriginalJob(false);
              setSelectedJobs(new Set());
            }} disabled={deletingJob}>
              {deletingJob && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Retry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pause Queue Confirmation Dialog */}
      <AlertDialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause Queue?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to pause the {queueName} queue? No jobs will be processed until the queue is resumed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePauseQueue} disabled={pausingQueue}>
              {pausingQueue && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pause Queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resume Queue Confirmation Dialog */}
      <AlertDialog open={resumeDialogOpen} onOpenChange={setResumeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume Queue?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to resume the {queueName} queue?.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResumeQueue} disabled={resumingQueue}>
              {resumingQueue && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resume Queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drain Queue Confirmation Dialog */}
      <AlertDialog open={drainDialogOpen} onOpenChange={setDrainDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drain Queue?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drain the {queueName} queue? This will remove all jobs that are waiting or delayed, but not active, waiting-children, completed or failed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDrainQueue}
              disabled={drainingQueue}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {drainingQueue && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Drain Queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
