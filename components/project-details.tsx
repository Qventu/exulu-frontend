"use client";

import * as React from "react";
import { useState, useContext } from "react";
import { useQuery, useMutation, useApolloClient } from "@apollo/client";
import { UPDATE_PROJECT, DELETE_PROJECT, GET_AGENT_SESSIONS, GET_AGENTS, CREATE_AGENT_SESSION, GET_ITEM_BY_ID, UPDATE_AGENT_SESSION_PROJECT, REMOVE_AGENT_SESSION_BY_ID, DELETE_ITEM } from "@/queries/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, MessageSquare, Settings2, Files, AlertTriangle, Shield, Pencil, Search, Bot, PackageMinus } from "lucide-react";
import { RBACControl } from "@/components/rbac";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Loading } from "./ui/loading";
import { Agent } from "@/types/models/agent";
import { useRouter } from "next/navigation";
import { AgentSession } from "@/types/models/agent-session";
import { Project } from "@/types/models/project";
import { checkChatSessionWriteAccess } from "@/lib/check-chat-session-write-access";
import { UserContext } from "@/app/(application)/authenticated";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Item } from "@/types/models/item";
import { FileItem } from "./uppy-dashboard";
import { ItemsSelectionModal } from "./items-selection-modal";
import { files } from "@/util/api";

interface ProjectDetailsProps {
  project: Project;
}

export function ProjectDetails({ project }: ProjectDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAgentSelectionOpen, setIsAgentSelectionOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");
  const [activeView, setActiveView] = useState<'overview' | 'context' | 'sessions' | 'access' | 'settings'>('overview');
  const { user } = useContext(UserContext);
  const router = useRouter();
  const [deleteOptions, setDeleteOptions] = useState({
    deleteItems: false,
    deleteSessions: false,
  });
  const [formData, setFormData] = useState({
    name: project.name || "",
    description: project.description || "",
    custom_instructions: project.custom_instructions || "",
  });
  const { toast } = useToast();

  const [rbac, setRbac] = useState({
    rights_mode: project.rights_mode,
    users: project.RBAC?.users,
    roles: project.RBAC?.roles,
    // projects: project.RBAC?.projects
  })

  const [projectItems, setProjectItems] = useState<string[]>(project.project_items || []);
  const [updateProject, { loading: isSaving }] = useMutation(UPDATE_PROJECT);
  const [deleteProject] = useMutation(DELETE_PROJECT);
  const [deletingProject, setDeletingProject] = useState(false);
  const { data: sessionsData, loading: sessionsLoading, refetch: refetchSessions } = useQuery(GET_AGENT_SESSIONS, {
    variables: {
      page: 1,
      limit: 50,
      filters: [
        { project: { eq: project.id } }
      ]
    }
  });

  const { data: agentsData, loading: agentsLoading } = useQuery(GET_AGENTS, {
    variables: {
      page: 1,
      limit: 100,
      filters: [],
      sort: { field: "updatedAt", direction: "DESC" }
    }
  });

  const apolloClient = useApolloClient()

  const [createAgentSession, { loading: isCreatingSession }] = useMutation(CREATE_AGENT_SESSION);

  const [updateAgentSession, { loading: isUpdatingSession }] = useMutation(UPDATE_AGENT_SESSION_PROJECT);

  const [deleteSession, { loading: isDeletingSession }] = useMutation(REMOVE_AGENT_SESSION_BY_ID);

  const chatSessions: AgentSession[] = sessionsData?.agent_sessionsPagination?.items || [];
  const agents: Agent[] = agentsData?.agentsPagination?.items || [];

  const filteredAgents = React.useMemo(() => {
    if (!agentSearch) return agents;
    return agents.filter(agent =>
      agent.name.toLowerCase().includes(agentSearch.toLowerCase())
    );
  }, [agents, agentSearch]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateProject({
        variables: {
          id: project.id,
          input: {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            custom_instructions: formData.custom_instructions.trim() || null,
          },
        },
      });

      toast({
        title: "Success",
        description: "Project updated successfully!",
      });

      setIsEditing(false);
    } catch (error: any) {
      console.error("Error updating project:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    if (project) {
      setFormData({
        name: project.name || "",
        description: project.description || "",
        custom_instructions: project.custom_instructions || "",
      });
    }
    setIsEditing(false);
  };

  const handleNewChatSession = () => {
    setIsAgentSelectionOpen(true);
  };

  const handleAgentSelect = async (agent: Agent) => {
    try {
      const result = await createAgentSession({
        variables: {
          title: `New session with ${agent.name}`,
          agent: agent.id,
          project: project.id,
          rights_mode: "private",
          /* RBAC: {
            projects: [{ id: project.id, rights: "read" }]
          } */
        },
      });

      const sessionId = result.data?.agent_sessionsCreateOne?.item?.id;

      if (sessionId) {
        toast({
          title: "Success",
          description: "Session created successfully! Sessions started in a project are accessible for viewing by project members.",
        });

        setIsAgentSelectionOpen(false);
        setAgentSearch("");

        router.push(`/chat/${agent.id}/${sessionId}`);
      }
    } catch (error: any) {
      console.error("Error creating session:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create session. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProject = async () => {
    try {
      setDeletingProject(true);
      if (deleteOptions.deleteItems) {
        await Promise.all(projectItems.map(async (item) => {
          const context = item.split("/")[0];
          const id = item.split("/")[1];
          if (!context || !id) return;
          const { data } = await apolloClient.mutate({
            mutation: DELETE_ITEM(context, []),
            variables: { id },
          });

          if (data[`${context}_itemsRemoveOneById`]?.s3key) {
            try {
              await files.delete(data[`${context}_itemsRemoveOneById`]?.s3key)
            } catch (error: any) {
              console.error("[EXULU] Error deleting file from s3 storage:", error);
            }
          }

        }));
      }

      await Promise.all(chatSessions.map(async (session) => {
        if (deleteOptions.deleteSessions) {
          await deleteSession({
            variables: { id: session.id },
          });
        } else {
          await updateAgentSession({
            variables: { id: session.id, project: null },
          });
        }
      }))

      await deleteProject({
        variables: { id: project.id },
      });

      toast({
        title: "Success",
        description: `Project "${project.name}" has been deleted successfully.`,
      });

      // Navigate back to projects list or close modal
      setIsDeleteDialogOpen(false);
      setDeletingProject(false);
      router.push('/projects');
    } catch (error: any) {
      setDeletingProject(false);
      console.error("Error deleting project:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex-1 p-6 mt-20">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex gap-6 h-full">
          <div className="w-80 space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">{project.name}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {project.description || "No description provided."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="space-y-2">
              <Button
                variant={activeView === 'overview' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveView('overview')}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Project information
              </Button>
              <Button
                variant={activeView === 'context' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveView('context')}
              >
                <Files className="h-4 w-4 mr-2" />
                Project files
              </Button>
              <Button
                variant={activeView === 'sessions' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveView('sessions')}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Project sessions
              </Button>
              <Button
                variant={activeView === 'access' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveView('access')}
              >
                <Shield className="h-4 w-4 mr-2" />
                Access control
              </Button>
              <Button
                variant={activeView === 'settings' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveView('settings')}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Project settings
              </Button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {activeView === 'overview' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Project Information</CardTitle>
                    <CardDescription>
                      Basic information about this project
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Project Name</Label>
                        {isEditing ? (
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        ) : (
                          <p className="text-sm">{project.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      {isEditing ? (
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={3}
                        />
                      ) : (
                        <p className="text-sm">{project.description || "No description provided"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instructions">Custom Instructions</Label>
                      {isEditing ? (
                        <Textarea
                          id="instructions"
                          value={formData.custom_instructions}
                          onChange={(e) => setFormData({ ...formData, custom_instructions: e.target.value })}
                          rows={4}
                          placeholder="Enter custom instructions for sessions in this project..."
                        />
                      ) : (
                        <p className="text-sm">{project.custom_instructions || "No custom instructions set"}</p>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button variant="outline" onClick={handleCancel}>
                              Cancel
                            </Button>
                            <Button onClick={handleSave}>
                              <span>Save changes</span>
                              {
                                isSaving && (
                                  <Loading className="mr-2" />
                                )
                              }
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" onClick={() => setIsEditing(true)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              </div>
            )}

            {activeView === 'context' && (
              <div className="space-y-6 w-full">
                <Card>
                  <CardHeader>
                    <CardTitle>Project context items</CardTitle>
                    <CardDescription>
                      Items that provide context for sessions in this project (max 15 items). Note that different
                      agents may have different file types supported.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <ItemsSelectionModal onConfirm={(data) => {
                        const update = [...projectItems, ...data.map((x) => `${x.context.id}/${x.item.id}`)];
                        console.log("update", update);
                        setProjectItems(update);
                        updateProject({
                          variables: {
                            id: project.id,
                            input: {
                              project_items: update
                            }
                          }
                        })
                      }} />

                      {/* List of items */}
                      <div className="space-y-2">
                        {
                          <div className="space-y-2">
                            {
                              projectItems?.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                  <Files className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                  <p>No items added to the project context yet.</p>
                                </div>
                              )
                            }
                            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                              {projectItems?.map((gid) => (
                                <ProjectItem key={gid} gid={gid} onRemove={(gid) => {
                                  const update = projectItems.filter((g) => g !== gid)
                                  setProjectItems(update)
                                  updateProject({
                                    variables: {
                                      id: project.id,
                                      input: {
                                        project_items: update
                                      }
                                    }
                                  })
                                }} />
                              ))}
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeView === 'sessions' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Project sessions</CardTitle>
                    <CardDescription>
                      Sessions associated with this project
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button onClick={handleNewChatSession} className="w-full" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Start new session
                      </Button>

                      <div className="space-y-2">
                        {chatSessions.map((session) => {
                          const writeAccess = checkChatSessionWriteAccess(session, user);
                          return (
                            <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <MessageSquare className="h-4 w-4" />
                                <div>
                                  <Link href={`/chat/${session.agent}/${session.id}`}>
                                    <p className="font-medium max-w-[80%] truncate">{session.title}</p>
                                  </Link>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      disabled={!writeAccess || isUpdatingSession}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (isUpdatingSession) return;
                                        updateAgentSession({
                                          variables: {
                                            id: session.id,
                                            project: null
                                          }
                                        })
                                        refetchSessions();
                                      }}>
                                      <PackageMinus className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Remove session from project.</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      disabled={!writeAccess || isDeletingSession}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (isDeletingSession) return;
                                        deleteSession({
                                          variables: {
                                            id: session.id
                                          }
                                        })
                                        refetchSessions();
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete session completely.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          )
                        }
                        )}
                      </div>

                      {chatSessions.length === 0 && !sessionsLoading && (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No sessions found</p>
                        </div>
                      )}

                      {sessionsLoading && (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Loading sessions...</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeView === 'access' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Access Control</CardTitle>
                    <CardDescription>
                      Control who can access this project
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RBACControl
                      allowedModes={['private', 'users', 'roles']}
                      initialRightsMode={project.rights_mode || 'private'}
                      initialUsers={project.RBAC?.users}
                      initialRoles={project.RBAC?.roles}
                      // initialProjects={project.RBAC?.projects}
                      onChange={(rights_mode, users, roles) => {
                        setRbac({
                          rights_mode,
                          users,
                          roles,
                          // projects
                        })
                      }}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button onClick={() => {
                      updateProject({
                        variables: {
                          id: project.id,
                          input: {
                            rights_mode: rbac.rights_mode,
                            RBAC: {
                              users: rbac.users,
                              roles: rbac.roles,
                              // projects: rbac.projects
                            }
                          }
                        }
                      })
                    }}>
                      <span>Save access rights</span>
                      {isSaving && <Loading className="ml-2" />}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}

            {activeView === 'settings' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>
                      Permanently delete this project and all associated data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-destructive">Delete Project</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            This action cannot be undone. This will permanently delete the project and optionally remove all associated context files and sessions.
                          </p>
                        </div>
                      </div>

                      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Project
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Delete Project</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete "{project.name}"? This action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="delete-items"
                                checked={deleteOptions.deleteItems}
                                onCheckedChange={(checked) =>
                                  setDeleteOptions(prev => ({ ...prev, deleteItems: checked as boolean }))
                                }
                              />
                              <label htmlFor="delete-items" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Also delete all context items ({projectItems?.length} items)
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="delete-sessions"
                                checked={deleteOptions.deleteSessions}
                                onCheckedChange={(checked) =>
                                  setDeleteOptions(prev => ({ ...prev, deleteSessions: checked as boolean }))
                                }
                              />
                              <label htmlFor="delete-sessions" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Also delete all sessions ({chatSessions.length} sessions)
                              </label>
                            </div>
                            {(deleteOptions.deleteItems || deleteOptions.deleteSessions) && (
                              <div className="flex items-start gap-2 p-3 border border-amber-200 rounded-lg bg-amber-50">
                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                                <p className="text-sm text-amber-800">
                                  {deleteOptions.deleteItems && deleteOptions.deleteSessions
                                    ? "All context items and sessions will be permanently deleted."
                                    : deleteOptions.deleteItems
                                      ? "All context items will be permanently deleted."
                                      : "All sessions will be permanently deleted."
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                          <DialogFooter className="sm:justify-start">
                            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button disabled={deletingProject} variant="destructive" onClick={handleDeleteProject}>
                              {
                                deletingProject ? (
                                  <Loading className="mr-2 w-4 h-4" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
                                )
                              }
                              Delete Project
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent Selection Modal */}
      <Dialog open={isAgentSelectionOpen} onOpenChange={setIsAgentSelectionOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Select an Agent</DialogTitle>
            <DialogDescription>
              Choose an agent to start a new chat session. Sessions started in a project are accessible for viewing by project members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Agents Grid */}
            <div className="max-h-96 overflow-y-auto">
              {agentsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredAgents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="p-4 border rounded-lg hover:border-primary cursor-pointer transition-colors"
                      onClick={() => handleAgentSelect(agent)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          {agent.image ? (
                            <img
                              src={agent.image}
                              alt={agent.name}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <Bot className="h-6 w-6" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{agent.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {agent.description || `${agent.type} agent`}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={agent.active ? "default" : "secondary"} className="text-xs">
                              {agent.active ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {agent.type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{agentSearch ? "No agents found matching your search" : "No agents available"}</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAgentSelectionOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectItem({ gid, onRemove }: { gid: string, onRemove: (gid: string) => void }) {

  const context = gid.split("/")[0];
  const id = gid.split("/")[1];
  if (!context) return null;
  if (!id) return null;

  const { data, loading } = useQuery<
    {
      [key: string]: Item
    }>(GET_ITEM_BY_ID(context, []), {
      variables: {
        id
      }
    });

  if (loading) {
    return (
      <Card className="group relative overflow-hidden">
        <CardContent className="p-4">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3 mt-1" />
        </CardContent>
      </Card>
    );
  }

  const item = data?.[context + "_itemsById"];

  if (!item) return null;

  // Format date to be more readable
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Card className="group relative overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/50">
      <CardContent className="p-4">
        {/* Icon and Remove Button */}
        <div className="flex items-start justify-between mb-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(gid);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        {/* Item Name */}
        <div className="mb-2">
          <h4 className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">
            {item.name || "Untitled"}
          </h4>
        </div>

        {/* Item Description */}
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2.5rem]">
            {item.description}
          </p>
        )}

        {/* Metadata Section */}
        <div className="space-y-2 pt-2 border-t">
          {/* Context Type */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{context.replace(/_/g, ' ')}</span>
            {item.updatedAt && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(item.updatedAt)}
              </span>
            )}
          </div>

          {/* Text Length Indicator */}
          {item.textlength && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{item.textlength.toLocaleString()} chars</span>
              {item.chunks && item.chunks.length > 0 && (
                <span className="text-xs">• {item.chunks.length} chunks</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}