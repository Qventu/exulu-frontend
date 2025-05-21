import { UserContext } from "@/app/(application)/authenticated";
import { Clock, Hash, Percent } from "lucide-react"
import { useContext } from "react"
import { StatsCard } from "./stats-card"
import { useJobStatistics } from "@/hooks/use-job-statistics"

export function formatDuration(seconds: number): string {
  if (!seconds) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

export function StatsCards({ agent }: { agent: string }) {

  const { user } = useContext(UserContext);
  const { stats, loading, successRate } = useJobStatistics(user.id, agent);
  const duration = stats ? formatDuration(stats.averageDuration) : "Loading...";
  const defaultValue = loading ? "Loading..." : "N/a";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatsCard
        title="Completed Runs (7d)"
        value={stats?.completedCount || defaultValue}
        icon={Hash}
      />
      <StatsCard
        title="Avg. Duration"
        value={duration}
        icon={Clock}
      />
      <StatsCard
        title="Success Rate"
        value={`${successRate || defaultValue}${!loading && successRate ? '%' : ''}`}
        icon={Percent}
      />
    </div>
  );
}

