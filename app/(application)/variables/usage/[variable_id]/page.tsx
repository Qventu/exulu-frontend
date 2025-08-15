"use client";

import { useQuery } from "@apollo/client";
import { ArrowLeft, User, Bot, Workflow } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useState } from "react";
import {
  GET_VARIABLE_BY_ID,
  GET_USER_BY_ID,
  GET_AGENT_BY_ID,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface ResourceInfo {
  id: string;
  type: 'user' | 'agent' | 'workflow';
  name: string;
  loading: boolean;
  error?: string;
}

export default function VariableUsagePage() {
  const params = useParams();
  const variableId = params.variable_id as string;
  const [page, setPage] = useState(1);
  const limit = 10;

  const { loading: variableLoading, error: variableError, data: variableData } = useQuery(GET_VARIABLE_BY_ID, {
    variables: { id: variableId },
    skip: !variableId,
  });

  const variable = variableData?.variableById;
  const usedBy = variable?.used_by || [];

  // Paginate the used_by array
  const totalPages = Math.ceil(usedBy.length / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const currentPageUsedBy = usedBy.slice(startIndex, endIndex);

  // Parse the used_by IDs and fetch resource details
  const [resourcesInfo, setResourcesInfo] = useState<Record<string, ResourceInfo>>({});

  // Initialize resource info when used_by changes
  React.useEffect(() => {
    if (usedBy.length > 0) {
      const initialResources: Record<string, ResourceInfo> = {};
      usedBy.forEach(resourceId => {
        const [type, id] = resourceId.split('/');
        initialResources[resourceId] = {
          id,
          type: type as 'user' | 'agent' | 'workflow',
          name: '',
          loading: true,
        };
      });
      setResourcesInfo(initialResources);
    }
  }, [usedBy]);

  // Fetch individual resource details
  currentPageUsedBy.forEach(resourceId => {
    const [type, id] = resourceId.split('/');
    
    if (type === 'user') {
      useQuery(GET_USER_BY_ID, {
        variables: { id },
        skip: !id,
        onCompleted: (data) => {
          if (data?.userById) {
            setResourcesInfo(prev => ({
              ...prev,
              [resourceId]: {
                ...prev[resourceId],
                name: `${data.userById.firstname} ${data.userById.lastname}`.trim() || data.userById.email,
                loading: false,
              }
            }));
          }
        },
        onError: () => {
          setResourcesInfo(prev => ({
            ...prev,
            [resourceId]: {
              ...prev[resourceId],
              name: 'Unknown User',
              loading: false,
              error: 'Failed to load user',
            }
          }));
        }
      });
    } else if (type === 'agent' || type === 'workflow') {
      useQuery(GET_AGENT_BY_ID, {
        variables: { id },
        skip: !id,
        onCompleted: (data) => {
          if (data?.agentById) {
            setResourcesInfo(prev => ({
              ...prev,
              [resourceId]: {
                ...prev[resourceId],
                name: data.agentById.name,
                loading: false,
              }
            }));
          }
        },
        onError: () => {
          setResourcesInfo(prev => ({
            ...prev,
            [resourceId]: {
              ...prev[resourceId],
              name: type === 'agent' ? 'Unknown Agent' : 'Unknown Flow',
              loading: false,
              error: type === 'agent' ? 'Failed to load agent' : 'Failed to load flow',
            }
          }));
        }
      });
    }
  });

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'agent':
        return <Bot className="h-4 w-4" />;
      case 'workflow':
        return <Workflow className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getResourceBadgeVariant = (type: string) => {
    switch (type) {
      case 'user':
        return 'default';
      case 'agent':
        return 'secondary';
      case 'workflow':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (variableLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (variableError || !variable) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <h1 className="text-2xl font-bold">Variable not found</h1>
        <p className="text-muted-foreground">The requested variable could not be loaded.</p>
        <Link href="/variables">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Variables
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center space-x-4">
        <Link href="/variables">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Variable Usage</h1>
          <p className="text-muted-foreground">
            Resources using variable "{variable.name}"
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Variable Details
            <Badge variant={variable.encrypted ? "default" : "outline"}>
              {variable.encrypted ? "Encrypted" : "Plain Text"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Created {new Date(variable.createdAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Name:</span> {variable.name}
            </div>
            <div>
              <span className="font-medium">Used by:</span> {usedBy.length} resource{usedBy.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardContent>
      </Card>

      {usedBy.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-medium">No Usage Found</h3>
            <p className="text-muted-foreground">This variable is not currently being used by any resources.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Resource Usage ({usedBy.length})</CardTitle>
            <CardDescription>
              Resources that reference this variable
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPageUsedBy.map((resourceId) => {
                  const [type, id] = resourceId.split('/');
                  const resource = resourcesInfo[resourceId];

                  return (
                    <TableRow key={resourceId}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getResourceIcon(type)}
                          <Badge variant={getResourceBadgeVariant(type)}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {resource?.loading ? (
                          <Loading />
                        ) : resource?.error ? (
                          <span className="text-muted-foreground">{resource.name}</span>
                        ) : (
                          resource?.name || 'Loading...'
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {id}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(endIndex, usedBy.length)} of {usedBy.length} resources
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}