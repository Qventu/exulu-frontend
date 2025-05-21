"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import EmbeddingChart from "./chart"
import { RecentJobs } from "@/components/custom/recent-jobs"
import { JOB_STATUS } from "@/util/enums/job-status"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { contexts } from "@/util/api"

export default function ContextsDashboard() {

  const { data, isLoading } = useQuery<{
    active: number,
    inactive: number,
    sources: number,
    queries: number,
    jobs: {
      date: string,
      count: number
    }[]
    totals: {
      embeddings: number
    }
  }>({
    queryKey: ["context-statistics"],
    queryFn: async () => {
      const response = await contexts.statistics();
      const json = await response.json();
      console.log({ statistics: json})
      return json
    },
    staleTime: 60000
  })

  return (
    <main className="w-100 p-10">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Data manager</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Embedding Jobs</CardDescription>
              {
                isLoading ? <Skeleton className="h-10 w-20" /> : <CardTitle className="text-2xl">{ data?.totals.embeddings || 0 }</CardTitle>
              }
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Contexts</CardDescription>
              {
                isLoading ? <Skeleton className="h-10 w-20" /> : <CardTitle className="text-2xl">{ data?.active || 0 }</CardTitle>
              }
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Sources</CardDescription>
              <CardTitle className="text-2xl">
              {
                isLoading ? <Skeleton className="h-10 w-20" /> : <CardTitle className="text-2xl">{ data?.sources || 0 }</CardTitle>
              }
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Embedding Queries</CardDescription>
              {
                isLoading ? <Skeleton className="h-10 w-20" /> : <CardTitle className="text-2xl">{ data?.queries || 0 }</CardTitle>
              }
            </CardHeader>
          </Card>
        </div>

        <Card className="col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Embedding Generations</CardTitle>
                <CardDescription>Number of embeddings generated over time</CardDescription>
              </div>
              {/* <Tabs defaultValue="30days" className="w-auto">
                <TabsList>
                  <TabsTrigger value="7days">Last 7 days</TabsTrigger>
                  <TabsTrigger value="30days">Last 30 days</TabsTrigger>
                  <TabsTrigger value="3months">Last 3 months</TabsTrigger>
                </TabsList>
              </Tabs> */}
            </div>
          </CardHeader>
          <CardContent className="h-[300px]">
            {
              isLoading ? <Skeleton className="h-full w-full" /> : <EmbeddingChart jobs={data?.jobs ?? []} />
            }
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentJobs
              type="embedder"
              statusses={[
                JOB_STATUS.completed,
                JOB_STATUS.active,
                JOB_STATUS.waiting,
                JOB_STATUS.delayed,
                JOB_STATUS.paused,
                JOB_STATUS.failed
              ].join(",")}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}