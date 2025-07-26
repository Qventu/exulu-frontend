"use client";

import { useMutation, useQuery } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { AgentDelete } from "@/app/(application)/agents/components/agent-delete";
import {
  GET_USER_ROLES,
  UPDATE_USER_ROLE_BY_ID,
  REMOVE_AGENT_BY_ID, UPDATE_AGENT, GET_AGENT_BY_ID, CREATE_AGENT_SESSION
} from "@/queries/queries";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UserRole } from "@EXULU_SHARED/models/user-role";
import { Agent } from "@EXULU_SHARED//models/agent";
import Link from "next/link";
import { UserContext } from "@/app/(application)/authenticated";
import { Tool } from "@EXULU_SHARED/models/tool";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { CopyIcon } from "@/icons";

const agentFormSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: "Agent name must be at least 2 characters.",
    })
    .max(300, {
      message: "Agent name must not be longer than 300 characters.",
    }),
  description: z
    .string()
    .max(10000, {
      message:
        "Agent description must not be longer than 10.000 characters.",
    })
    .nullable()
    .optional(),
  public: z.boolean().nullable().optional(),
  id: z.string().or(z.number()).nullable().optional(),
  active: z.any(),
  access: z.boolean().nullable().optional(),
});

export default function AgentForm({
  agent,
  refetch,
}: {
  agent: Agent;
  refetch: any;
}) {

  const router = useRouter();
  const [errors, setErrors] = useState<string>();
  const { user, setUser } = useContext(UserContext);
  const [enabledTools, setEnabledTools] = useState<string[]>(agent.enabledTools || [])
  const { toast } = useToast();

  const copyAgentId = async () => {
    try {
      await navigator.clipboard.writeText(agent.id);
      toast({ title: "Agent ID copied to clipboard" });
    } catch (error) {
      toast({ title: "Failed to copy Agent ID", variant: "destructive" });
    }
  };

  const [updateUserRole, updateUserRoleResult] = useMutation(
    UPDATE_USER_ROLE_BY_ID,
    {
      refetchQueries: [
        GET_USER_ROLES, // DocumentNode object parsed with gql
        "GetUserRoles", // Query name
      ],
    },
  );

  const roles = useQuery(GET_USER_ROLES, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: 30,
    },
  });

  const [deleteAgent, deleteAgentResult] = useMutation(
    REMOVE_AGENT_BY_ID,
    {
      onCompleted: (data) => {
        router.push(`/agents`, { scroll: false });
      },
    },
  );

  const [updateAgent, updateAgentResult] = useMutation(
    UPDATE_AGENT,
    {
      refetchQueries: [
        GET_AGENT_BY_ID,
        "GetAgentById"
      ],
    },
  );

  type AgentFormValues = z.infer<typeof agentFormSchema>;

  const agentForm = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: agent ?? {
      name: "New agent",
      steps: [],
    },
    mode: "onChange",
  });

  const [createAgentSession, createAgentSessionResult] = useMutation(
    CREATE_AGENT_SESSION,
  );

  return (
    <div className="h-full flex-col md:flex">
      <div className="container flex flex-col items-start justify-between space-y-2 py-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16">
        <div className="ml-auto flex w-full space-x-2 sm:justify-end">
          {agent?.id && (
            <Button
              onClick={agentForm.handleSubmit(
                async (data) => {
                  console.log("data", data)
                  updateAgent({
                    variables: {
                      id: data.id,
                      name: data.name,
                      public: data.public,
                      description: data.description,
                      active: data.active,
                    },
                  });
                  refetch();
                },
                (data) => {
                  console.error("form data invalid", data);
                  setErrors(JSON.stringify(data));
                },
              )}
              disabled={updateAgentResult.loading}
              variant={"secondary"}
              type="submit">
              Save {updateAgentResult.loading && <Loading />}
            </Button>
          )}
          <Button
            onClick={() => {
              router.push("/agents", { scroll: false });
            }}
            variant={"secondary"}
            type="button">
            Back
          </Button>
          <AgentDelete
            agent={agent}
            deleteAgent={deleteAgent}
            deleteAgentResult={deleteAgentResult}
          />
        </div>
      </div>
      <Separator />
      <Tabs defaultValue="complete" className="flex-1">
        <div className="container h-full py-6">
          <div className="grid h-full items-stretch gap-6">
            <div className="md:order-1">
              <div className="flex flex-col space-y-4">
                <div className="h-full">
                  <Form {...agentForm}>
                    <form className="space-y-8">
                      <div className="grid grid-rows-1 grid-flow-col gap-6 lg:grid-cols-2">
                        <div className="col">
                          <div className="flex flex-col space-y-4">
                            <div className="flex flex-col space-y-2">
                              <Card>
                                <CardHeader>
                                  <div className="flex items-center justify-between">
                                    <CardTitle>Agent</CardTitle>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <span>ID: {agent.id}</span>
                                      <button
                                        type="button"
                                        onClick={copyAgentId}
                                        className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground"
                                        title="Copy Agent ID"
                                      >
                                        <CopyIcon />
                                      </button>
                                    </div>
                                  </div>
                                  {errors ? (
                                    <Alert variant="destructive">
                                      <ExclamationTriangleIcon className="size-4" />
                                      <AlertTitle>Error</AlertTitle>
                                      <AlertDescription>
                                        {errors}
                                      </AlertDescription>
                                    </Alert>
                                  ) : null}
                                </CardHeader>
                                <CardContent className="grid gap-4">
                                  <FormField
                                    control={agentForm.control}
                                    name={`name`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="text"
                                            className="resize-none"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={agentForm.control}
                                    name={`description`}
                                    render={({ field }: any) => {
                                      if (!field.value) {
                                        field.value = "";
                                      }
                                      return (
                                        <FormItem>
                                          <FormLabel>Description</FormLabel>
                                          <FormControl>
                                            <Textarea
                                              className="resize-none"
                                              {...field}
                                              value={field.value ?? ""}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      );
                                    }}
                                  />
                                </CardContent>
                              </Card>
                            </div>
                            <FormField
                              control={agentForm.control}
                              name="active"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">
                                      Is this agent active?
                                    </FormLabel>
                                    <FormDescription>
                                      When active this agent will be available via the Exulu UI
                                      and API endpoint.
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={agentForm.control}
                              name="access"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5 w-full">
                                    <FormLabel className="text-base">
                                      Access levels
                                    </FormLabel>

                                    <div className="w-full !mt-3">
                                      <FormField
                                        control={agentForm.control}
                                        name={`public`}
                                        render={({ field }) => (
                                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                              <FormLabel className="text-base">
                                                Public
                                              </FormLabel>
                                              <FormDescription>
                                                If set to public anyone with the
                                                url can access it.
                                              </FormDescription>
                                            </div>
                                            <FormControl>
                                              <Switch
                                                checked={
                                                  agentForm.getValues(
                                                    "public",
                                                  ) ?? false
                                                }
                                                onCheckedChange={field.onChange}
                                              />
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />

                                      {!agentForm.getValues("public") && (
                                        <>
                                          {!roles.data?.loading &&
                                            roles.data?.rolesPagination
                                              ?.items ? (
                                            <>
                                              {roles.data.rolesPagination.items.map(
                                                (role: UserRole, index) => {
                                                  return (
                                                    <div
                                                      key={index}
                                                      className="space-y-4 my-3 w-full"
                                                    >
                                                      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                        <div className="space-y-0.5 w-full ">
                                                          <label className="font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-base">
                                                            {role.name}
                                                          </label>
                                                        </div>
                                                        <Switch
                                                          disabled={
                                                            updateUserRoleResult.loading
                                                          }
                                                          checked={role.agents
                                                            ?.includes(
                                                              agent.id,
                                                            )}
                                                          onCheckedChange={(
                                                            value,
                                                          ) => {
                                                            const updated =
                                                              value
                                                                ? [
                                                                  ...(role.agents || []),
                                                                  agent.id,
                                                                ]
                                                                : (role.agents || []).filter(
                                                                  (id) =>
                                                                    id !==
                                                                    agent.id,
                                                                );
                                                            updateUserRole({
                                                              variables: {
                                                                id: role.id,
                                                                agents: JSON.stringify(updated),
                                                              },
                                                            });
                                                          }}
                                                        />
                                                      </div>
                                                    </div>
                                                  );
                                                },
                                              )}
                                            </>
                                          ) : (
                                            <div className="p-3">
                                              <p className="text-center">
                                                No user roles found. You can create roles <Link
                                                  href="/roles">here</Link>
                                              </p>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                    <FormMessage />
                                  </div>
                                </FormItem>
                              )}
                            />

                            {
                              agent.type !== "custom" && (

                                <Card>
                                  <CardContent className="grid gap-4 pt-6">
                                    <p>
                                      You can test this agent using the Exulu
                                      UI without activating the agent if you
                                      are an admin.
                                    </p>
                                    <Button
                                      onClick={async () => {
                                        console.log("agent", agent)
                                        if (agent.type === "flow") {
                                          router.push(
                                            `/playground/${agent.id}/${agent.type}`,
                                          );
                                          return;
                                        } else {
                                          // todo fix create session!
                                          const result = await createAgentSession({
                                            variables: {
                                              user: user.id,
                                              agent: agent.id,
                                              type: agent.type,
                                              createdAt: new Date().toISOString(),
                                              updatedAt: new Date().toISOString(),
                                            }
                                          })
                                          console.log("result", result)
                                          const sessionId = result?.data?.agentSessionCreateOne?.record?.id
                                          router.push(
                                            `/playground/${agent.id}/${agent.type}/${sessionId}`,
                                          );
                                        }
                                      }}
                                      type={"button"}
                                      variant={"default"}>
                                      Go to playground
                                    </Button>
                                  </CardContent>
                                </Card>
                              )
                            }
                          </div>
                        </div>
                        <div className="col">
                          {
                            agent.type !== "custom" && (
                              <Card>
                                <CardHeader>
                                  <CardTitle>Capabilities</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="flex flex-col space-y-4">
                                    <div className="space-y-4">
                                      <p className="text-sm text-muted-foreground">
                                        This agent can use the following capabilities:
                                      </p>
                                      <div className="grid gap-3">
                                        <div className="flex items-center justify-between rounded-lg border p-3">
                                          <span className="font-medium">Tools</span>
                                          <Badge variant={agent.capabilities?.tools ? "default" : "secondary"}>
                                            {agent.capabilities?.tools ? "Enabled" : "Disabled"}
                                          </Badge>
                                        </div>
                                        <div className="flex items-center justify-between rounded-lg border p-3">
                                          <span className="font-medium">Images</span>
                                          <div className="flex gap-1">
                                            {agent.capabilities?.images?.length ? (
                                              agent.capabilities.images.map((format, i) => (
                                                <Badge key={i} variant="outline">{format}</Badge>
                                              ))
                                            ) : (
                                              <Badge variant="secondary">None</Badge>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between rounded-lg border p-3">
                                          <span className="font-medium">Files</span>
                                          <div className="flex gap-1">
                                            {agent.capabilities?.files?.length ? (
                                              agent.capabilities.files.map((format, i) => (
                                                <Badge key={i} variant="outline">{format}</Badge>
                                              ))
                                            ) : (
                                              <Badge variant="secondary">None</Badge>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between rounded-lg border p-3">
                                          <span className="font-medium">Audio</span>
                                          <div className="flex gap-1">
                                            {agent.capabilities?.audio?.length ? (
                                              agent.capabilities.audio.map((format, i) => (
                                                <Badge key={i} variant="outline">{format}</Badge>
                                              ))
                                            ) : (
                                              <Badge variant="secondary">None</Badge>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between rounded-lg border p-3">
                                          <span className="font-medium">Video</span>
                                          <div className="flex gap-1">
                                            {agent.capabilities?.video?.length ? (
                                              agent.capabilities.video.map((format, i) => (
                                                <Badge key={i} variant="outline">{format}</Badge>
                                              ))
                                            ) : (
                                              <Badge variant="secondary">None</Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          }

                          <Card className="mt-4">
                            <CardHeader>
                              <CardTitle>Tools</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex flex-col space-y-4">
                                <div className="space-y-4">
                                  <div>
                                    <h3 className="text-lg font-medium">Enabled Tools</h3>
                                    <p className="text-sm text-muted-foreground">Tools that are currently enabled for this agent.</p>
                                    {agent.availableTools?.map((tool: Tool) => (
                                      <div key={tool?.id} className="flex items-center justify-between rounded-lg border p-4 mt-2">
                                        <div>
                                          <div className="font-medium">{tool?.name}</div>
                                          <div className="text-sm text-muted-foreground">{tool?.description}</div>
                                          <Badge variant={"outline"} className="mt-2">{tool?.type}</Badge>
                                        </div>
                                        <Switch
                                          checked={enabledTools.includes(tool.id)}
                                          onCheckedChange={(value) => {
                                            let updated = [...enabledTools]
                                            if (value) {
                                              updated = [...enabledTools, tool.id]
                                            } else {
                                              updated = enabledTools.filter(t => t !== tool.id);
                                            }
                                            setEnabledTools(updated);
                                            updateAgent({
                                              variables: {
                                                id: agent.id,
                                                tools: JSON.stringify(updated)
                                              },
                                            });

                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </form>
                  </Form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
