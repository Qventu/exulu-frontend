"use client";

import { useState } from "react";
import { useQuery, useMutation, NetworkStatus } from "@apollo/client";
import { GET_QUEUE, GET_JOBS, DELETE_JOB, PAUSE_QUEUE, DRAIN_QUEUE, RESUME_QUEUE } from "@/queries/queries";
import { QueueJob } from "@/types/models/job";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [jobToDelete, setJobToDelete] = useState<QueueJob | null>(null);
  const [jobToRetry, setJobToRetry] = useState<QueueJob | null>(null);
  const [status, setStatus] = useState<JobStatus>("completed");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

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
    onCompleted: () => {
      toast({
        title: "Job deleted",
        description: "The job has been successfully deleted.",
      });
      refetchJobs();
      refetchQueue();
      setJobToDelete(null);
    },
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
    setJobToDelete(job);
  };

  const handleRetryJob = (job: QueueJob) => {
    setJobToRetry(job);
  };

  const confirmDeleteJob = () => {
    if (!jobToDelete?.id) {
      toast({
        title: "Failed to delete job",
        description: "The job has no ID.",
        variant: "destructive",
      });
      return;
    }
    if (jobToDelete) {
      deleteJob({
        variables: {
          queue: queueName,
          id: jobToDelete.id,
        },
      });
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
    <>
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
          {/* Queue Stats - Compact Layout */}
          {queue && (
            <div className="flex items-center gap-8 p-4 bg-muted/50 rounded-lg">
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
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">Concurrency:</div>
                <div className="font-semibold">{queue.concurrency}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">Rate Limit:</div>
                <div className="font-semibold">{queue.ratelimit || "None"}</div>
              </div>
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
                  <TabsTrigger value="completed" className="gap-1.5">
                    <span>Completed</span>
                    <Badge variant="secondary" className="ml-1 bg-green-100 text-green-600 border-green-200">
                      {queue.jobs?.completed || 0}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Jobs Table */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Queue Jobs</h3>
                <p className="text-xs text-muted-foreground">All jobs currently in the {queueName} queue</p>
              </div>
              <Badge variant="outline">
                Auto Refresh: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />
              </Badge>
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
                      <TableHead>Name</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Inputs</TableHead>
                      <TableHead>Outputs</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.items?.map((job, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {nameGenerator(job)}
                        </TableCell>
                        <TableCell>{getStatusBadge(job.state)}</TableCell>
                        <TableCell>
                          {job.timestamp ? format(new Date(job.timestamp), "MMM d, yyyy HH:mm:ss") : "N/A"}
                        </TableCell>
                        <TableCell>
                          {job.data ? (
                            <div className="text-xs max-w-[200px] truncate">
                              <TextPreview
                                text={JSON.stringify(job.data)}
                              />
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {job.failedReason ? (
                            <div className="text-xs text-red-600 max-w-[200px] truncate">
                              <TextPreview
                                text={"Error: " + job.failedReason}
                              />
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground max-w-[200px] truncate">
                              <TextPreview
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
                        console.log(
                          "itemsData.data?.pageInfo.hasPreviousPage",
                          jobs?.pageInfo?.hasPreviousPage,
                        );
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

      {/* Delete Job Confirmation Dialog */}
      <AlertDialog open={!!jobToDelete} onOpenChange={(open) => !open && setJobToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the job "{jobToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteJob} disabled={deletingJob}>
              {deletingJob && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Job Confirmation Dialog */}
      <AlertDialog open={!!jobToRetry} onOpenChange={(open) => !open && setJobToRetry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry Job?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to retry the job "{jobToRetry?.name}"? This will schedule a new job with the same data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!jobToRetry) {
                return;
              }
              retryJob(jobToRetry);
            }} disabled={deletingJob}>
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
    </>
  );
}
