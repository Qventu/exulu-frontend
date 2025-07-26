"use client"

import { useEffect, useState } from "react";
import { StatsCards } from "@/components/stats-cards"
import * as React from "react";
import {useQuery as apolloQuery, useQuery} from "@apollo/client/react/hooks/useQuery";
import {GET_AGENT_BY_ID, GET_JOB_BY_ID} from "@/queries/queries";
import {useQuery as reactQuery} from "@tanstack/react-query";
import {AgentBackend} from "@EXULU_SHARED/models/agent-backend";
import {workflows} from "@/util/api";
import {Alert} from "@/components/ui/alert";
import {Agent} from "@EXULU_SHARED/models/agent";
import { WorkflowForm } from "@/components/workflow-form";
import { Job } from "@EXULU_SHARED/models/job";
import JobMonitor from "../components/job-monitor";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { TextPreview } from "@/components/custom/text-preview";
import JsonViewerComponent, { JsonViewer } from "../components/json-viewer";
export const dynamic = "force-dynamic";


interface PageProps {
  params: {
    agent: string
    session: string
  }
}

export default function AgentPage({ params }: PageProps) {

  const [isMobile, setIsMobile] = useState(false);

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

  const [selectedJob, setSelectedJob] = React.useState<Job>()

  const agentQuery = apolloQuery(GET_AGENT_BY_ID, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      id: params.agent,
    },
  });

  const jobQuery = useQuery(GET_JOB_BY_ID, {
    returnPartialData: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    skip: !params.session || params.session === "new",
    variables: {
      id: params.session,
    },
  });

  const backendQuery = reactQuery<AgentBackend>({
    queryKey: ["agentsBackend", agentQuery.data?.agentById?.backend],
    enabled: !!agentQuery.data?.agentById,
    queryFn: async () => {
      const result = await workflows.get({
        id: agentQuery.data.agentById.backend
      }, 1);
      const json = await result.json();
      return json;
    },
  });

  if (agentQuery.loading || backendQuery.isLoading || jobQuery.loading) {
    return (
        <>
          <div className="w-full pr-6">
            <Skeleton className="h-[200px] w-full mt-5 mx-3" />
            <Skeleton className="h-20 w-full mt-5 mx-3" />
            <Skeleton className="h-20 w-full mt-5 mx-3" />
            <Skeleton className="h-20 w-full mt-5 mx-3" />
            <Skeleton className="h-20 w-full mt-5 mx-3" />
            <Skeleton className="h-20 w-full mt-5 mx-3" />
            <Skeleton className="h-20 w-full mt-5 mx-3" />
          </div>
        </>
    );
  }

  if (agentQuery.error)
    return (
        <Alert title="Error" variant="destructive" className="m-5">
          {agentQuery.error.message}
        </Alert>
    );

  if (jobQuery.error)
    return (
        <Alert title="Error" variant="destructive" className="m-5">
          {jobQuery.error.message}
        </Alert>
    );

  if (backendQuery.error)
    return (
        <Alert title="Error" variant="destructive" className="m-5">
          {backendQuery.error.message}
        </Alert>
    );

  if (!agentQuery.data?.agentById || !backendQuery.data)
    return (
        <Alert title="Error" variant="destructive" className="m-5">
          No data found.
        </Alert>
    );

  const agent: Agent = agentQuery.data.agentById;
  const backend: AgentBackend = backendQuery.data;

  async function handleSubmit(data: any) {
    console.log("Processing single job:", data)!
    console.log("backend", backend)
    const response = await workflows.run(backend.slug, {
      inputs: data,
      agent: agent.id,
      session: params.session,
      label: "TEST LABEL"
    })
    const json = await response.json();
    console.log("job", json.job);
    setSelectedJob({
      id: json.job.jobId,
      name: json.job.name,
      status: json.job.status,
      agent: agent.id,
      type: "workflow",
      updatedAt: new Date(json.job.updatedAt)
    })
    return { ...json.job, status: data?.job?.status };
  }

  async function handleBatchSubmit(file: File) {
    // Process batch jobs from CSV
    console.log("Processing batch jobs from:", file)
  }

  const renderJsonValue = (value: any, label: string) => {
    if (value === null || value === undefined) {
      return (
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{label}:</h3>
          <TextPreview text={value} markdown={true} />
        </div>
      );
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return (
          <div>
            <h3 className="text-lg font-semibold tracking-tight">{label}:</h3>
            {value.map((item, index) => (
              <div key={index} className="ml-4 mt-2">
                {renderJsonValue(item, `Item ${index + 1}`)}
              </div>
            ))}
          </div>
        );
      }

      return (
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{label}:</h3>
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="ml-4 mt-2">
              {renderJsonValue(val, key)}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{label}:</h3>
        <TextPreview text={value} markdown={true} />
      </div>
    );
  };

  const results = () => {
    try {
      const json = JSON.parse(jobQuery.data?.jobById?.result || "{}");
      return renderJsonValue(json, "Result");
    } catch (error) {
      return (
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Error</h3>
          <TextPreview text="Invalid JSON data" markdown={true} />
        </div>
      );
    }
  };
  

  return (
      <div className="flex-1 space-y-8 p-8 pt-6 overflow-y-scroll">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold tracking-tight">{agent.name}</h2>
          <p className="text-md tracking-tight">{agent.description}</p>
          <StatsCards agent={agent.id} />
        </div>
        {
          selectedJob?.id && <JobMonitor onDismiss={() => {
            setSelectedJob(undefined)
          }} job={selectedJob.id}/>
        }

        {
          !selectedJob?.id && <WorkflowForm agent={agent} inputs={jobQuery.data?.jobById?.inputs} backend={backend} onSubmit={handleSubmit}
          onBatchSubmit={handleBatchSubmit}/>
        }
      
        <div className="space-y-4">
          <h3 className="text-xl font-semibold tracking-tight">Results</h3>
          {
              jobQuery.data?.jobById?.result ? <JsonViewer data={JSON.parse(jobQuery.data?.jobById?.result || "{}")} /> : <Alert title="No results" variant="destructive" className="mt-5">
                No results found.
              </Alert>
            }
        </div>

      </div>
)
}

