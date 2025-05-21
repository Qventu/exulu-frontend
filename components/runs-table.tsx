import { CheckCircle, Clock, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Run {
  id: string
  title: string
  status: "completed" | "failed" | "processing"
  duration: string
  createdAt: string
}

interface RunsTableProps {
  runs: Run[]
}

export function RunsTable({ runs }: RunsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Output</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell>{run.title}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {run.status === "completed" && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {run.status === "failed" && <XCircle className="h-4 w-4 text-red-500" />}
                  {run.status === "processing" && <Clock className="h-4 w-4 text-yellow-500" />}
                  {run.status}
                </div>
              </TableCell>
              <TableCell>{run.duration}</TableCell>
              <TableCell>{run.createdAt}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" disabled={run.status !== "completed"}>
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

