"use client";

import { useQuery } from "@apollo/client";
import { AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GET_JOB_STATISTICS_ENHANCED } from "@/queries/queries";

export function JobsStatusArea() {
  // Poll every 2 seconds for real-time updates
  const { data, loading, error } = useQuery(GET_JOB_STATISTICS_ENHANCED, {
    variables: {
      // Get all jobs for current user - backend will handle access control
    },
    pollInterval: 2000,
    fetchPolicy: "network-only" // Always fetch fresh data
  });

  if (error) {
    console.error("Error fetching job statistics:", error);
    return null;
  }

  const stats = data?.jobStatistics || {
    runningCount: 0,
    erroredCount: 0,
    completedCount: 0,
    failedCount: 0,
    averageDuration: 0
  };

  const statusCards = [
    {
      title: "Running Jobs",
      value: stats.runningCount,
      description: "Currently executing",
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Errored Jobs", 
      value: stats.erroredCount,
      description: "Failed or stuck",
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Completed Jobs",
      value: stats.completedCount,
      description: "Successfully finished",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Failed Jobs",
      value: stats.failedCount,
      description: "Execution failed",
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-50",
    }
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-full ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : card.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {stats.completedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Average execution time: <span className="font-medium text-foreground">
                {loading ? "..." : `${Math.round(stats.averageDuration)} seconds`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}