import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Copy, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import {useQuery as apolloQuery} from "@apollo/client/react/hooks/useQuery";
import { GET_JOB_BY_ID } from "@/queries/queries";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation";

export default function JobMonitor(props: { job: string, onDismiss: () => void }) {

    console.log("props", props)
    const router = useRouter();
    const [job, setJob] = useState(props.job)

    const { data, startPolling, stopPolling, loading, error } = apolloQuery(GET_JOB_BY_ID, {
        variables: { id: job },
        pollInterval: 5000, // Poll every 5 seconds
        onCompleted: (data) => {
          if (data.jobById.status !== "waiting") {
            stopPolling(); // Stop polling once the job is no longer waiting
          }
        },
      });

      useEffect(() => {
        setJob(props.job)
    }, [props.job]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast({
            title: "Copied!",
            description: "Job id copied to clipboard",
        })
    }

    if (loading) {
        return (
            <>
              <div className="min-h-screen flex flex-col items-center justify-center mt-5">
                Loading...
              </div>
            </>
        );
      }
    
      if (error)
        return (
            <Alert title="Error" variant="destructive" className="m-5">
              {error.message}
            </Alert>
        );

      if (!data.jobById)
        return (
            <Alert title="Error" variant="destructive" className="m-5">
              No data found
            </Alert>
        );

    return (<Alert className="border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-900">
        <Key className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-600 dark:text-green-400">Scheduled {data.jobById.name}</AlertTitle>
        <AlertDescription className="mt-4">
            <div className="mb-2 text-sm text-muted-foreground">
                <strong>Important:</strong> you can check progress on this page in the "recent runs" section, or on the jobs table (in the main navigation).
            </div>
            <div className="flex items-center gap-2 mt-2">
                <code className="relative rounded bg-muted px-[0.5rem] py-[0.3rem] font-mono text-sm font-semibold overflow-x-auto max-w-[calc(100%-40px)]">
                    The job ID is {data.jobById.id}
                </code>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(data.jobById.id)}
                    className="h-8 w-8 flex-shrink-0"
                >
                    <Copy className="h-4 w-4" />
                </Button>
            </div>

            <Button
                variant="link"
                className="mt-2 h-auto p-0 text-green-600 dark:text-green-400"
                onClick={() => {
                    router.push(`/jobs/${data.jobById.id}`, {
                        scroll: false,
                      });
                }}
            >
                View details
            </Button>

            <Button
                variant="link"
                className="mt-2 ml-2 h-auto p-0 text-red-600 dark:text-red-400"
                onClick={() => {
                    props.onDismiss()
                }}
            >
                Dismiss
            </Button>
        </AlertDescription>
    </Alert>)
}