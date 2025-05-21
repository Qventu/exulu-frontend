import { GET_JOB_STATISTICS } from "@/queries/queries"
import { useQuery } from "@apollo/client"
import { useMemo } from "react"

export interface JobStatistics {
  completedCount: number
  failedCount: number
  averageDuration: number
}

export function useJobStatistics(userId: string, agent: string) {
  const dateRange = useMemo(() => ({
    sevenDaysAgo: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    now: new Date(Date.now())
  }), [])

  const { data, loading, error } = useQuery(GET_JOB_STATISTICS, {
    variables: {
      user: userId,
      agent: agent,
      from: dateRange.sevenDaysAgo,
      to: dateRange.now
    }
  })

  const stats = data?.jobStatistics as JobStatistics | undefined
  const totalRuns = (stats?.completedCount || 0) + (stats?.failedCount || 0)
  const successRate = totalRuns > 0 
    ? Math.round((stats?.completedCount || 0) / totalRuns * 100) 
    : 0

  return {
    stats,
    loading,
    error,
    successRate,
    totalRuns
  }
} 