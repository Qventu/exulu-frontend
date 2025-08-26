"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Edit, Eye, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SaveWorkflowModal } from "@/components/save-workflow-modal";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation } from "@apollo/client";
import { GET_JOBS, REMOVE_WORKFLOW_TEMPLATE_BY_ID, GET_WORKFLOW_TEMPLATES } from "@/queries/queries";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export type Workflow = {
  id: string;
  name: string;
  description?: string;
  owner: number;
  rights_mode: "private" | "users" | "roles" | "public" | "projects";
  RBAC: {
    users: Array<{ id: string; rights: "read" | "write" }>;
    roles: Array<{ id: string; rights: "read" | "write" }>;
  };
  variables?: any[];
  steps_json?: any[];
  createdAt: string;
  updatedAt: string;
};

export type WorkflowWithLastRun = Workflow & {
  lastRunAt?: string;
  lastRunStatus?: string;
};

function useLastRunForWorkflow(workflowId: string) {
  const { data } = useQuery(GET_JOBS, {
    variables: {
      page: 1,
      limit: 1,
      filters: [
        {
          workflow: { eq: workflowId }
        }
      ],
      sort: { field: "createdAt", direction: "DESC" }
    },
    pollInterval: 5000 // Poll every 5 seconds for recent runs
  });

  const lastJob = data?.jobsPagination?.items?.[0];
  return {
    lastRunAt: lastJob?.createdAt,
    lastRunStatus: lastJob?.status
  };
}

function LastRunCell({ workflowId }: { workflowId: string }) {
  const { lastRunAt, lastRunStatus } = useLastRunForWorkflow(workflowId);

  if (!lastRunAt) {
    return <span className="text-muted-foreground text-sm">Never run</span>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': case 'stuck': return 'bg-red-100 text-red-800';
      case 'active': case 'waiting': case 'delayed': case 'paused': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm">
        {formatDistanceToNow(new Date(lastRunAt), { addSuffix: true })}
      </div>
      <Badge variant="outline" className={getStatusColor(lastRunStatus)}>
        {lastRunStatus}
      </Badge>
    </div>
  );
}

function WorkflowActionsCell({ workflow, user }: { workflow: WorkflowWithLastRun; user: any }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const { toast } = useToast();
  
  // Determine if user has write access
  const hasWriteAccess = (() => {
    if (workflow.owner === user.id) return true;
    if (workflow.rights_mode === 'public') return false; // Public workflows can only be edited by owner
    if (workflow.rights_mode === 'users' && workflow.RBAC.users) {
      const userAccess = workflow.RBAC.users.find(u => u.id === user.id.toString());
      return userAccess?.rights === 'write';
    }
    if (workflow.rights_mode === 'roles' && workflow.RBAC.roles && user.role) {
      const roleAccess = workflow.RBAC.roles.find(r => r.id === user.role);
      return roleAccess?.rights === 'write';
    }
    return false;
  })();

  const [removeWorkflow] = useMutation(REMOVE_WORKFLOW_TEMPLATE_BY_ID, {
    refetchQueries: [GET_WORKFLOW_TEMPLATES, "GetWorkflowTemplates"],
  });

  const handleDelete = async () => {
    if (deleteConfirmation !== workflow.name) {
      toast({
        title: "Error",
        description: "Please type the workflow name exactly to confirm deletion.",
        variant: "destructive",
      });
      return;
    }

    try {
      await removeWorkflow({
        variables: { id: workflow.id },
      });
      toast({
        title: "Workflow deleted",
        description: `"${workflow.name}" has been successfully deleted.`,
      });
      setIsDeleteModalOpen(false);
      setDeleteConfirmation('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the workflow. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Transform workflow back to messages format for the modal
  const workflowMessages = workflow.steps_json?.map((step: any, index: number) => ({
    id: step.id || `msg_${index}`,
    role: step.type === 'user' ? 'user' as const : 
          step.type === 'assistant' ? 'assistant' as const : 
          'system' as const,
    content: step.content || step.contentExample || `Tool: ${step.toolName}`,
    ...(step.type === 'tool' && {
      parts: [{
        type: 'tool-invocation',
        toolInvocation: {
          toolName: step.toolName
        }
      }]
    })
  })) || [];

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditModalOpen(true)}
        >
          {hasWriteAccess ? <Edit className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // TODO: Implement workflow run functionality
            console.log('Run workflow:', workflow.id);
          }}
        >
          <Play className="h-4 w-4" />
        </Button>
        {hasWriteAccess && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <SaveWorkflowModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        messages={workflowMessages}
        sessionTitle={workflow.name}
        existingWorkflow={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          rights_mode: workflow.rights_mode,
          RBAC: workflow.RBAC,
          variables: workflow.variables,
          steps_json: workflow.steps_json
        }}
        isReadOnly={!hasWriteAccess}
      />

      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the workflow "{workflow.name}" and cannot be undone.
              <br /><br />
              To confirm, please type the workflow name below:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-confirmation" className="text-sm font-medium">
              Workflow name
            </Label>
            <Input
              id="delete-confirmation"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={workflow.name}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteConfirmation('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmation !== workflow.name}
            >
              Delete Workflow
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function createColumns(user: any): ColumnDef<WorkflowWithLastRun>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const workflow = row.original;
        return (
          <div className="flex flex-col gap-1">
            <div className="font-medium">{workflow.name}</div>
            {workflow.description && (
              <div className="text-sm text-muted-foreground line-clamp-1">
                {workflow.description}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "visibility",
      header: "Visibility",
      cell: ({ row }) => {
        const visibility = row.original.rights_mode || 'private';
        const getVisibilityColor = (visibility: string) => {
          switch (visibility) {
            case 'private': return 'bg-gray-100 text-gray-800';
            case 'public': return 'bg-green-100 text-green-800';
            case 'users': return 'bg-blue-100 text-blue-800';
            case 'roles': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
          }
        };
        const getVisibilityText = (visibility: string) => { 
          switch (visibility) {
            case 'private': return 'Private';
            case 'public': return 'Public';
            case 'users': return `Users (${row.original.RBAC.users.length})`;
            case 'roles': return `Roles (${row.original.RBAC.roles.length})`;
            default: return 'Private';
          }
        };
        return (
          <Badge variant="outline" className={getVisibilityColor(visibility)}>
            {getVisibilityText(visibility)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
          className="p-0"
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const createdAt = row.getValue("createdAt") as string;
        return (
          <div className="text-sm">
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </div>
        );
      },
    },
    {
      id: "lastRun",
      header: "Last Run",
      cell: ({ row }) => {
        return <LastRunCell workflowId={row.original.id} />;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        return <WorkflowActionsCell workflow={row.original} user={user} />;
      },
    },
  ];
}