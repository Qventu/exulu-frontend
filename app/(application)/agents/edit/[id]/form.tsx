"use client";

import { useMutation, useQuery } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useContext, useState, useEffect, useMemo } from "react";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { AgentDelete } from "@/app/(application)/agents/components/agent-delete";
import {
  REMOVE_AGENT_BY_ID, UPDATE_AGENT_BY_ID, GET_AGENT_BY_ID, GET_VARIABLES,
  GET_TOOLS, GET_TOOL_CATEGORIES, GET_CONTEXTS,
  COPY_AGENT_BY_ID, GET_SKILLS,
} from "@/queries/queries";
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
import { Agent, AgentTool } from "@EXULU_SHARED//models/agent";
import { UserContext } from "@/app/(application)/authenticated";
import { ExuluTool } from "@EXULU_SHARED/models/tool";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { CopyIcon } from "@/icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Wrench, Image, FileText, Volume2, Video, Info, AlertCircle, Settings, Text, Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { RBACControl } from "@/components/rbac";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Variable } from "@/types/models/variable";
import UppyDashboard, { FileDataCard } from "@/components/uppy-dashboard";
import AgentVisual from "@/components/lottie";
import { ConfigContext } from "@/components/config-context";
import { TextPreview } from "@/components/custom/text-preview";
import { PromptBrowserSheet } from "./components/prompt-browser-sheet";
import { usePrompts } from "@/hooks/use-prompts";
import { Response } from '@/components/ai-elements/response';
import { PromptCard } from "@/app/(application)/prompts/components/prompt-card";
import { AgentModelSelector } from "../../components/agent-model-selector";
import { RerankerSelector } from "@/components/reranker-selector";
import { AgentHierarchyView } from "./components/agent-hierarchy-view";

const categories = [
  "marketing",
  "sales",
  "finance",
  "hr",
  "coding",
  "support",
  "research",
  "knowledge",
  "product"
]

// Component for handling individual tool configuration items
export const VariableSelectionElement = ({
  configItem,
  disabled,
  currentValue,
  variables,
  onVariableSelect
}: {
  configItem: { name: string; description: string; default?: string | boolean | number },
  disabled: boolean,
  currentValue: string | boolean | number,
  variables: any[],
  onVariableSelect: (variableName: string) => void
}) => {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const selectedVariable = variables.find((v: any) => v.name === currentValue);

  return (
    <div className="space-y-2">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            aria-expanded={popoverOpen}
            className="w-full justify-between text-sm">
            {selectedVariable ? selectedVariable.name : "Select variable..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search variables..." />
            <CommandList>
              <CommandEmpty>No variables found.</CommandEmpty>
              <CommandGroup>
                {variables.map((variable: any) => (
                  <CommandItem
                    key={variable.id}
                    onSelect={() => {
                      onVariableSelect(variable.name);
                      console.log("variable", variable)
                      setPopoverOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        currentValue === variable.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{variable.name}</span>
                      {variable.encrypted && (
                        <span className="text-xs text-muted-foreground">🔒 Encrypted</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
        {
          configItem.default && (
            <Card>
              <CardHeader>
                <CardTitle className="text-md">Default value</CardTitle>
              </CardHeader>
              <CardContent>
                <TextPreview text={configItem.default?.toString() || ''} sliceLength={200} />
              </CardContent>
            </Card>
          )
        }
      </Popover>
    </div>
  );
};

const agentFormSchema = z.object({
  model: z.string().optional(),
  welcomemessage: z.string().optional(),
  defaultagent: z.boolean().optional(),
  feedback: z.boolean().optional(),
  suggestions_enabled: z.boolean().optional(),
  name: z
    .string()
    .min(2, {
      message: "Agent name must be at least 2 characters.",
    })
    .max(300, {
      message: "Agent name must not be longer than 300 characters.",
    }),
  category: z.string().optional(),
  description: z
    .string()
    .max(10000, {
      message:
        "Agent description must not be longer than 10.000 characters.",
    })
    .nullable()
    .optional(),
  instructions: z
    .string()
    .max(40000, {
      message:
        "Agent instructions must not be longer than 40.000 characters.",
    })
    .nullable()
    .optional(),
  id: z.string().or(z.number()).nullable().optional(),
  active: z.any(),
  firewall: z.object({
    enabled: z.boolean().optional(),
    scanners: z.object({
      promptGuard: z.boolean().optional(),
      codeShield: z.boolean().optional(),
      agentAlignment: z.boolean().optional(),
      hiddenAscii: z.boolean().optional(),
      piiDetection: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

export default function AgentForm({
  agent,
}: {
  agent: Agent;
}) {

  const router = useRouter();
  const { user } = useContext(UserContext);
  const configContext = useContext(ConfigContext);
  console.log("agent tools", agent.tools)
  const [enabledTools, setEnabledTools] = useState<AgentTool[]>(
    // Convert legacy string[] format to new object format
    agent.tools ? agent.tools : []
  )
  const [enabledSkills, setEnabledSkills] = useState<{ id: string; name: string }[]>(
    agent.skills ? agent.skills : []
  )
  const [sheetOpen, setSheetOpen] = useState<boolean | string>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [isPromptBrowserOpen, setIsPromptBrowserOpen] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);
  const [selectedModel, setSelectedModel] = useState<string>(agent.model || '')
  const [firewallEnabled, setFirewallEnabled] = useState<boolean>(agent.firewall?.enabled || false)
  const [animation_idle, setAnimation_idle] = useState<string>(agent.animation_idle || '')
  const [animation_responding, setAnimation_responding] = useState<string>(agent.animation_responding || '')
  const [rbac, setRbac] = useState({
    rights_mode: agent.rights_mode,
    users: agent.RBAC?.users,
    roles: agent.RBAC?.roles,
    // projects: agent.RBAC?.projects
  })
  const [firewallScanners, setFirewallScanners] = useState({
    promptGuard: agent.firewall?.scanners?.promptGuard || false,
    codeShield: agent.firewall?.scanners?.codeShield || false,
    agentAlignment: agent.firewall?.scanners?.agentAlignment || false,
    hiddenAscii: agent.firewall?.scanners?.hiddenAscii || false,
    piiDetection: agent.firewall?.scanners?.piiDetection || false,
  })
  const [memory, setMemory] = useState<string>(agent.memory || '')
  const { toast } = useToast();

  // Prepare query variables
  const toolsQueryVariables = useMemo(() => ({
    search: debouncedSearch || undefined,
    category: selectedCategory === "all" ? undefined : selectedCategory,
    limit: 100,
    page: 0
  }), [debouncedSearch, selectedCategory]);

  const { data: toolsData, loading: toolsLoading } = useQuery<{
    tools: {
      items: ExuluTool[]
      total: number
      page: number
      limit: number
    }
  }>(GET_TOOLS, {
    variables: toolsQueryVariables
  });

  const { data: variablesData } = useQuery<{
    variablesPagination: {
      items: Variable[]
    }
  }>(GET_VARIABLES, {
    variables: { page: 1, limit: 100 },
  });

  const { data: contextsData } = useQuery<{
    contexts: {
      items: { id: string; name: string; description: string; }[]
    }
  }>(GET_CONTEXTS);

  const { data: categoriesData } = useQuery<{
    toolCategories: string[]
  }>(GET_TOOL_CATEGORIES);

  const { data: skillsData } = useQuery<{
    skillsPagination: {
      items: { id: string; name: string; description?: string }[]
    }
  }>(GET_SKILLS, {
    variables: { page: 1, limit: 100 },
  });

  const variables = variablesData?.variablesPagination?.items || [];
  const contexts = contextsData?.contexts?.items || [];

  // Fetch prompts assigned to this agent using server-side filtering
  const { data: promptsData, loading: promptsLoading, refetch: refetchPrompts } = usePrompts({
    page: 1,
    limit: 100,
    filters: [{
      assigned_agents: {
        contains: agent.id
      }
    }],
  });

  const agentPrompts = promptsData?.prompt_libraryPagination?.items || [];

  // Filter out agent's own tool and group by category
  const filteredTools = useMemo(() => {
    return toolsData?.tools?.items?.filter((tool: ExuluTool) => tool.id !== agent.id) || [];
  }, [toolsData?.tools?.items, agent.id]);

  // Group tools by category for organized display
  const toolsByCategory = useMemo(() => {
    return filteredTools.reduce((acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category].push(tool);
      return acc;
    }, {} as Record<string, ExuluTool[]>);
  }, [filteredTools]);

  // Get categories from backend
  const availableCategories = categoriesData?.toolCategories || [];

  // Initialize all categories as collapsed when data loads
  useEffect(() => {
    if (availableCategories.length > 0) {
      const allCategories = new Set(Object.keys(toolsByCategory));
      setCollapsedCategories(allCategories);
    }
  }, [toolsByCategory]);

  // Clear search function
  const clearSearch = () => {
    setSearchTerm("");
    setSelectedCategory("all");
  };

  // Toggle category collapse state
  const toggleCategoryCollapse = (categoryName: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const copyAgentId = async () => {
    try {
      await navigator.clipboard.writeText(agent.id);
      toast({ title: "Agent ID copied to clipboard" });
    } catch (error) {
      toast({ title: "Failed to copy Agent ID", variant: "destructive" });
    }
  };

  // Reset selected users and roles when visibility changes

  const [deleteAgent, deleteAgentResult] = useMutation(
    REMOVE_AGENT_BY_ID,
    {
      onCompleted: () => {
        router.push(`/agents`, { scroll: false });
      },
    },
  );

  const [copyAgent, copyAgentResult] = useMutation(
    COPY_AGENT_BY_ID,
    {
      refetchQueries: [
        GET_AGENT_BY_ID,
        "GetAgentById"
      ],
      onCompleted: (data) => {
        console.log("Agent copied successfully", data)
        toast({ title: "Agent copied successfully" });
        router.push(`/agents/edit/${data?.agentsCopyOneById?.item?.id}`, { scroll: false });
      },
      onError: (error) => {
        toast({ title: "Failed to copy agent", variant: "destructive" });
      },
    },
  );

  const [updateAgent, updateAgentResult] = useMutation(
    UPDATE_AGENT_BY_ID,
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
      provider: undefined,
      name: "New agent",
      welcomemessage: "",
      defaultagent: false,
      instructions: "",
      steps: [],
      firewall: {
        enabled: false,
        scanners: {
          promptGuard: false,
          codeShield: false,
          agentAlignment: false,
          hiddenAscii: false,
          piiDetection: false,
        }
      },
    },
    mode: "onChange",
  });

  const agenticRetrievalTool = useMemo(() => {
    return toolsData?.tools?.items?.find((tool: ExuluTool) => tool.id === "agentic_context_search") || null;
  }, [toolsData?.tools?.items]);

  return (
    <div className="flex flex-col min-h-0">
      <div className="container flex flex-col items-start justify-between space-y-2 py-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16 flex-shrink-0">
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
                      description: data.description,
                      instructions: data.instructions,
                      welcomemessage: data.welcomemessage,
                      defaultagent: data.defaultagent,
                      category: data.category,
                      active: data.active,
                      memory: memory || null,
                      feedback: data.feedback,
                      suggestions_enabled: data.suggestions_enabled ?? false,
                      model: selectedModel || null,
                      animation_idle: animation_idle,
                      animation_responding: animation_responding,
                      rights_mode: rbac.rights_mode,
                      RBAC: {
                        users: rbac.users || [],
                        roles: rbac.roles || [],
                        // projects: rbac.projects || []
                      },
                      firewall: JSON.stringify({
                        enabled: firewallEnabled,
                        scanners: firewallScanners
                      }),
                      tools: JSON.stringify(enabledTools),
                      skills: JSON.stringify(enabledSkills)
                    },
                  });
                },
                (data) => {
                  console.error("form data invalid", data);
                },
              )}
              disabled={updateAgentResult.loading}
              variant={"secondary"}
              type="submit">
              Save {updateAgentResult.loading && <Loading className="ml-2" />}
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
          <Button
            onClick={() => {
              copyAgent({ variables: { id: agent.id } });
            }}
            disabled={copyAgentResult.loading}
            variant={"secondary"}
            type="button">
            Copy Agent {copyAgentResult.loading && <Loading className="ml-2" />}
          </Button>
        </div>
      </div>
      <Separator />
      <Tabs defaultValue="complete" className="flex-1 min-h-0 flex flex-col">
        <div className="container py-6 flex-1 overflow-auto">
          <div className="grid items-stretch gap-6">
            <div className="md:order-1">
              <div className="flex flex-col space-y-4">
                <div className="h-full">
                  <Form {...agentForm}>
                    <form className="space-y-8">
                      <div className="grid grid-rows-1 grid-flow-col gap-6 lg:grid-cols-2">
                        <div className="col">
                          <div className="flex flex-col space-y-4">
                            <Card>
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {agent.image && (
                                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                                        <img
                                          src={agent.image}
                                          alt={`${agent.name} profile`}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    )}
                                    <CardTitle>Agent</CardTitle>
                                  </div>
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
                                  name={`category`}
                                  render={({ field }: any) => {
                                    if (!field.value) {
                                      field.value = "";
                                    }
                                    return (
                                      <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <FormControl>
                                          <Select onValueChange={(value) => {
                                            field.onChange(value);
                                          }}>
                                            <SelectTrigger>
                                              <SelectValue className="capitalize" placeholder={field.value || `Select a category`} />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {
                                                categories.map((category) => (
                                                  <SelectItem className="capitalize" key={category} value={category}>
                                                    {category}
                                                  </SelectItem>
                                                ))
                                              }
                                            </SelectContent>
                                          </Select>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    );
                                  }}
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
                                            rows={2}
                                            {...field}
                                            value={field.value ?? ""}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    );
                                  }}
                                />
                                <FormField
                                  control={agentForm.control}
                                  name={`welcomemessage`}
                                  render={({ field }: any) => {
                                    return (
                                      <FormItem>
                                        <FormLabel>Welcome Message</FormLabel>
                                        {/* Optional: can be show in the Chat UI when the agent is first loaded */}
                                        <FormControl>
                                          <Textarea
                                            rows={2}
                                            {...field}
                                            value={field.value ?? ""}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    );
                                  }}
                                />
                                {
                                  agent.systemInstructions && <FormField
                                    control={agentForm.control}
                                    name={`instructions`}
                                    render={({ field }: any) => {
                                      return (
                                        <FormItem>
                                          <FormLabel>System Instructions</FormLabel>
                                          <FormDescription>
                                            These are system instructions set by the developer and
                                            cannot be changed via the UI. They are
                                            included in every session with this agent.
                                          </FormDescription>
                                          <FormControl>
                                            <Textarea
                                              disabled
                                              rows={5}
                                              value={agent.systemInstructions ?? ""}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      );
                                    }}
                                  />
                                }
                                <FormField
                                  control={agentForm.control}
                                  name={`instructions`}
                                  render={({ field }: any) => {
                                    if (!field.value) {
                                      field.value = "";
                                    }
                                    return (
                                      <FormItem>
                                        <FormLabel>Custom Instructions</FormLabel>
                                        <FormDescription>
                                          These are custom instructions you can set for this agent, they will be included
                                          in every session with this agent.
                                        </FormDescription>
                                        <FormControl>
                                          <Textarea
                                            rows={5}
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
                            <Card>
                              <CardContent className="pt-6">
                                <>
                                  <div className="text-sm font-medium mb-0">You can test this agent using the Exulu UI without activating the agent if you are a super admin:</div>
                                  <Button
                                    className="mt-2"
                                    onClick={async () => {
                                      console.log("agent", agent)
                                      router.push(
                                        `/chat/${agent.id}/new`,
                                      );
                                    }}
                                    type={"button"}
                                    variant={"default"}>
                                    Go to chat
                                  </Button>
                                </>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                        <div className="col">
                          <div className="flex flex-col space-y-4">
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
                                      When active this agent will be available via the UI
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
                              name="defaultagent"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">
                                      Set as default agent
                                    </FormLabel>
                                    <FormDescription>
                                      When enabled, this agent will be loaded as the default agent on the chat page.
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

                            <Card className="bg-transparent">
                              <Collapsible>
                                <CardHeader className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <p className="text-base">
                                        Access Control
                                      </p>
                                      <p className="text-sm text-muted-foreground mb-0">
                                        Control access to this agent.
                                      </p>
                                    </div>
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-8">
                                        <ChevronsUpDown className="size-4" />
                                        <span className="sr-only">Toggle</span>
                                      </Button>
                                    </CollapsibleTrigger>
                                  </div>
                                </CardHeader>

                                <CollapsibleContent className="mt-5">
                                  <CardContent className="space-y-4">
                                    <RBACControl
                                      initialRightsMode={agent.rights_mode}
                                      initialUsers={agent.RBAC?.users}
                                      initialRoles={agent.RBAC?.roles}
                                      // initialProjects={agent.RBAC?.projects}
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
                                </CollapsibleContent>
                              </Collapsible>
                            </Card>

                            <Card className="bg-transparent">
                              <Collapsible>
                                <CardHeader className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <p className="text-base">
                                        Provider Configuration <Badge variant="outline">{agent.modelName} from {agent.providerName}</Badge>
                                      </p>
                                      <p className="text-sm text-muted-foreground mb-0">
                                        Configure the language model provider assigned to this agent.
                                      </p>
                                    </div>
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-8">
                                        <ChevronsUpDown className="size-4" />
                                        <span className="sr-only">Toggle</span>
                                      </Button>
                                    </CollapsibleTrigger>
                                  </div>
                                </CardHeader>

                                <CollapsibleContent className="mt-5">
                                  <CardContent className="space-y-4">
                                    <div className="text-sm">
                                      This agent currently uses <b>{agent.modelName}</b> from <b>{agent.providerName}</b>. It supports the following modalities:
                                    </div>
                                    <TooltipProvider>
                                      <div className="flex items-center gap-3 mt-2">
                                        <div className={`p-2 rounded-md ${agent.capabilities?.text ? 'bg-none text-primary-foreground' : 'bg-gray-500 text-white'}`}>
                                          <Text className="h-4 w-4" />
                                        </div>

                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className={`p-2 rounded-md ${agent.capabilities?.images?.length ? 'bg-primary text-primary-foreground' : 'bg-gray-500 text-white'}`}>
                                              <Image className="h-4 w-4" />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Images: {agent.capabilities?.images?.length ? agent.capabilities.images.join(", ") : "None"}</p>
                                          </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className={`p-2 rounded-md ${agent.capabilities?.files?.length ? 'bg-primary text-primary-foreground' : 'bg-gray-500 text-white'}`}>
                                              <FileText className="h-4 w-4" />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Files: {agent.capabilities?.files?.length ? agent.capabilities.files.join(", ") : "None"}</p>
                                          </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className={`p-2 rounded-md ${agent.capabilities?.audio?.length ? 'bg-primary text-primary-foreground' : 'bg-gray-500 text-white'}`}>
                                              <Volume2 className="h-4 w-4" />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Audio: {agent.capabilities?.audio?.length ? agent.capabilities.audio.join(", ") : "None"}</p>
                                          </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className={`p-2 rounded-md ${agent.capabilities?.video?.length ? 'bg-primary text-primary-foreground' : 'bg-gray-500 text-white'}`}>
                                              <Video className="h-4 w-4" />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Video: {agent.capabilities?.video?.length ? agent.capabilities.video.join(", ") : "None"}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </TooltipProvider>
                                    <AgentModelSelector
                                      value={selectedModel}
                                      onSelect={(id) => {
                                        setSelectedModel(id);
                                        agentForm.setValue("model", id);
                                      }}
                                    />
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </Card>

                            <Card className="bg-transparent">
                              <Collapsible>
                                <CardHeader className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <p className="text-base">
                                        Prompt Templates
                                      </p>
                                      <p className="text-sm text-muted-foreground mb-0">
                                        Manage prompt templates assigned to this agent ({agentPrompts.length})
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsPromptBrowserOpen(true)}
                                      >
                                        <Settings className="h-4 w-4 mr-2" />
                                        Manage
                                      </Button>
                                      <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="icon" className="size-8">
                                          <ChevronsUpDown className="size-4" />
                                          <span className="sr-only">Toggle</span>
                                        </Button>
                                      </CollapsibleTrigger>
                                    </div>
                                  </div>
                                </CardHeader>

                                <CollapsibleContent className="mt-5">
                                  <CardContent className="space-y-4">
                                    {promptsLoading ? (
                                      <div className="text-sm text-muted-foreground">
                                        Loading prompts...
                                      </div>
                                    ) : agentPrompts.length === 0 ? (
                                      <div className="text-center py-6 border-2 border-dashed rounded-lg">
                                        <p className="text-sm text-muted-foreground mb-2">
                                          No prompts assigned to this agent yet, click the "Manage" button to add some.
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="grid gap-4">
                                        {agentPrompts.map((prompt: any) => (
                                          <PromptCard
                                            key={prompt.id}
                                            minimal={true}
                                            prompt={prompt}
                                            user={user}
                                            onUpdate={refetchPrompts}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </Card>

                            <Card className="bg-transparent">
                              <CardHeader className="p-4">
                                <div className="flex flex-col">
                                  <p className="text-base">Authentication</p>
                                  <p className="text-sm text-muted-foreground mb-0">
                                    Authentication is configured on the Model selected above. To change the API
                                    key or budget for this agent's model, edit the model itself.
                                  </p>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (selectedModel) {
                                      window.open(`/models/edit/${selectedModel}`, "_blank");
                                    } else {
                                      window.open(`/models`, "_blank");
                                    }
                                  }}
                                  disabled={!selectedModel}
                                >
                                  <Info className="h-4 w-4 mr-2" />
                                  {selectedModel ? "Edit this model" : "Manage models"}
                                </Button>
                              </CardContent>
                            </Card>

                            {/* Native memory configuration */}
                            <Card className="bg-transparent">
                              <Collapsible>
                                <CardHeader className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <p className="text-base">
                                        Agent Memory
                                        {
                                          memory ? (
                                            <Badge variant="outline" className="ml-2">
                                              enabled
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="ml-2">
                                              disabled
                                            </Badge>
                                          )
                                        }
                                      </p>
                                      <p className="text-sm text-muted-foreground mb-0">
                                        If enabled, long-term memory allows the agent to store new items during chat when prompted. Memories are user-scoped by default, with optional global memories created by admins. Memory retrieval occurs before any tool calls or response generation.
                                      </p>
                                    </div>
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-8">
                                        <ChevronsUpDown className="size-4" />
                                        <span className="sr-only">Toggle</span>
                                      </Button>
                                    </CollapsibleTrigger>
                                  </div>
                                </CardHeader>
                                <CollapsibleContent className="mt-5">
                                  <CardContent className="space-y-4">
                                    <div className="text-sm text-muted-foreground mb-0">
                                      Select the context to use for the agent's memory.
                                    </div>
                                    <div className="space-y-2 w-full overflow-x-hidden">
                                      <Popover modal={true}>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between text-sm"
                                          >
                                            {contexts.find((c: any) => c.id === memory)?.name || "Select context..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="max-h-[300px] p-0 z-[9999]">
                                          <Command>
                                            <CommandInput placeholder="Search contexts..." />
                                            <CommandList>
                                              <CommandEmpty>No contexts found.</CommandEmpty>
                                              <CommandGroup>
                                                <CommandItem
                                                  onSelect={() => {
                                                    setMemory('');
                                                  }}
                                                >
                                                  <Check
                                                    className={cn(
                                                      "mr-2 h-4 w-4",
                                                      memory === '' ? "opacity-100" : "opacity-0"
                                                    )}
                                                  />
                                                  <div className="flex flex-col">
                                                    <span className="text-muted-foreground">None</span>
                                                  </div>
                                                </CommandItem>
                                                {contexts.map((context: any) => (
                                                  <CommandItem
                                                    key={context.id}
                                                    onSelect={() => {
                                                      console.log("context", context)
                                                      setMemory(context.id);
                                                    }}
                                                  >
                                                    <Check
                                                      className={cn(
                                                        "mr-2 h-4 w-4",
                                                        memory === context.id ? "opacity-100" : "opacity-0"
                                                      )}
                                                    />
                                                    <div className="flex flex-col">
                                                      <span>{context.name}</span>
                                                      {context.description && (
                                                        <span className="text-xs text-muted-foreground line-clamp-1">{context.description}</span>
                                                      )}
                                                    </div>
                                                  </CommandItem>
                                                ))}
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </Card>

                            {/* Feedback configuration */}
                            <FormField
                              control={agentForm.control}
                              name="feedback"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">
                                      Enable feedback collection?
                                    </FormLabel>
                                    <FormDescription>
                                      When enabled, feedback can be collected from users during chat.
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

                            {/* Follow-up message suggestions */}
                            <FormField
                              control={agentForm.control}
                              name="suggestions_enabled"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">
                                      Enable follow-up suggestions?
                                    </FormLabel>
                                    <FormDescription>
                                      When enabled, after each assistant reply the chat suggests up to 3 follow-up
                                      messages the user might want to send. Uses the agent&apos;s model. Suggestion
                                      tokens count toward this agent&apos;s rate limits and statistics.
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

                            {configContext?.fileUploads?.s3endpoint && (
                              <Card className="bg-transparent">
                                <Collapsible>
                                  <CardHeader className="p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex flex-col">
                                        <p className="text-base">
                                          Custom Visualizations
                                        </p>
                                        <p className="text-sm text-muted-foreground mb-0">
                                          Upload custom Lottie animations for idle and responding states.
                                        </p>
                                      </div>
                                      <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="icon" className="size-8">
                                          <ChevronsUpDown className="size-4" />
                                          <span className="sr-only">Toggle</span>
                                        </Button>
                                      </CollapsibleTrigger>
                                    </div>
                                  </CardHeader>

                                  <CollapsibleContent className="mt-5">
                                    <CardContent className="space-y-4">
                                      <div className="grid grid-cols-1 gap-4">
                                        {/* Idle Animation */}
                                        <div className="space-y-2">
                                          <div>
                                            <div className="text-sm font-medium">Idle Animation</div>
                                            <div className="text-xs text-muted-foreground">Animation when agent is waiting</div>
                                          </div>

                                          <FileDataCard s3key={animation_idle}>
                                            <UppyDashboard
                                              id="agent-idle-animation"
                                              global={true}
                                              allowedFileTypes={['.json']}
                                              selectionLimit={1}
                                              buttonText=""
                                              dependencies={[agent.id]}
                                              onConfirm={(keys) => {
                                                if (keys.length > 0) {
                                                  setAnimation_idle(keys[0]);
                                                }
                                              }}
                                            />
                                            {animation_idle && (
                                              <div className="mt-2 p-2 border rounded bg-muted/30">
                                                <div className="text-xs text-muted-foreground mb-1">Preview:</div>
                                                <div className="w-12 h-12 mx-auto">
                                                  <AgentVisual
                                                    agent={{ ...agent, animation_idle }}
                                                    status="ready"
                                                  />
                                                </div>
                                              </div>
                                            )}
                                          </FileDataCard>
                                        </div>

                                        {/* Responding Animation */}
                                        <div className="space-y-2">
                                          <div>
                                            <div className="text-sm font-medium">Responding Animation</div>
                                            <div className="text-xs text-muted-foreground">Animation when agent is responding</div>
                                          </div>

                                          <FileDataCard s3key={animation_responding}>
                                            <UppyDashboard
                                              id="agent-responding-animation"
                                              global={true}
                                              allowedFileTypes={['.json']}
                                              selectionLimit={1}
                                              buttonText=""
                                              dependencies={[agent.id]}
                                              onConfirm={(keys) => {
                                                if (keys.length > 0) {
                                                  setAnimation_responding(keys[0]);
                                                }
                                              }}
                                            />
                                            {animation_responding && (
                                              <div className="mt-2 p-2 border rounded bg-muted/30">
                                                <div className="text-xs text-muted-foreground mb-1">Preview:</div>
                                                <div className="w-12 h-12 mx-auto">
                                                  <AgentVisual
                                                    agent={{ ...agent, animation_responding }}
                                                    status="streaming"
                                                  />
                                                </div>
                                              </div>
                                            )}
                                          </FileDataCard>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </CollapsibleContent>
                                </Collapsible>
                              </Card>
                            )}

                            {
                              agenticRetrievalTool && (
                                <Card className="bg-transparent">
                                  <Collapsible>
                                    <CardHeader className="p-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                          <p className="text-base">
                                            Agentic Retrieval Configuration
                                            {
                                              enabledTools.some(t => t.id === "agentic_context_search") ? (
                                                <Badge variant="outline" className="ml-2">
                                                  enabled
                                                </Badge>
                                              ) : <Badge variant="outline" className="ml-2">
                                                disabled
                                              </Badge>
                                            }
                                          </p>
                                          <p className="text-sm text-muted-foreground mb-0">
                                            Agentic retrieval uses a tool loop to intelligently
                                            search and retrieve relevant information across any number
                                            of knowledge contexts.
                                          </p>
                                        </div>
                                        <CollapsibleTrigger asChild>
                                          <Button variant="ghost" size="icon" className="size-8">
                                            <ChevronsUpDown className="size-4" />
                                            <span className="sr-only">Toggle</span>
                                          </Button>
                                        </CollapsibleTrigger>
                                      </div>
                                    </CardHeader>
                                    <CollapsibleContent className="mt-5">
                                      <CardContent className="space-y-4">

                                        <div className="text-sm text-muted-foreground mb-0">
                                          Configure the agentic retrieval tool. This tool is used to search and retrieve relevant information across any number of knowledge contexts.
                                        </div>

                                        <Switch
                                          checked={enabledTools.some(t => t.id === "agentic_context_search")}
                                          onCheckedChange={(value) => {
                                            let updated = [...enabledTools];
                                            if (value) {
                                              // Add tool with empty config initially
                                              const newToolConfig = {
                                                id: agenticRetrievalTool.id,
                                                type: agenticRetrievalTool.type,
                                                name: agenticRetrievalTool.name,
                                                config: agenticRetrievalTool.config?.map(configItem => ({
                                                  name: configItem.name,
                                                  variable: '',
                                                  type: configItem.type
                                                })) || []
                                              };
                                              updated = [...enabledTools, newToolConfig];
                                            } else {
                                              updated = enabledTools.filter(t => t.id !== agenticRetrievalTool.id);
                                            }
                                            setEnabledTools(updated);
                                          }}
                                        />

                                        <ToolConfigurationElement
                                          tool={agenticRetrievalTool}
                                          config={enabledTools.find(t => t.id === "agentic_context_search")?.config || []}
                                          variables={variables}
                                          update={(value, name) => {
                                            console.log("value", value)
                                            const updated = enabledTools.map(t => {
                                              if (t.id === "agentic_context_search") {
                                                return { ...t, config: t.config.map(c => c.name === name ? { ...c, variable: value } : c) }
                                              }
                                              return t;
                                            });
                                            console.log("updated", updated)
                                            setEnabledTools(updated);
                                          }}
                                        />
                                      </CardContent>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </Card>)
                            }
                            <Card >
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  Tools
                                  {toolsLoading && <Loading className="h-4 w-4" />}
                                </CardTitle>
                                <CardDescription>
                                  {enabledTools.length > 0 ? (
                                    `${enabledTools.length} tool${enabledTools.length === 1 ? '' : 's'} enabled for this agent`
                                  ) : (
                                    'No tools enabled for this agent'
                                  )}
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="flex flex-col space-y-4">
                                  {/* Search and Filter Controls */}
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                          placeholder="Search tools by name or description..."
                                          value={searchTerm}
                                          onChange={(e) => setSearchTerm(e.target.value)}
                                          className="pl-10 pr-10"
                                        />
                                        {searchTerm && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                            onClick={() => setSearchTerm("")}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                        <SelectTrigger className="w-[200px]">
                                          <SelectValue placeholder="Filter by category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="all">All categories</SelectItem>
                                          {availableCategories.map((category) => (
                                            <SelectItem key={category} value={category} className="capitalize">
                                              {category}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>

                                      {(searchTerm || selectedCategory !== "all") && (
                                        <Button variant="outline" onClick={clearSearch}>
                                          <X className="h-4 w-4" />
                                          <span className="sr-only">Clear filters</span>
                                        </Button>
                                      )}

                                      {/* Collapse / expand all */}

                                      <Button type={"button"} variant="outline" onClick={() => {
                                        setCollapsedCategories(new Set());
                                      }}>
                                        Expand all
                                      </Button>
                                      <Button type={"button"} variant="outline" onClick={() => {
                                        setCollapsedCategories(new Set(Object.keys(toolsByCategory)));
                                      }}>
                                        Collapse all
                                      </Button>
                                    </div>
                                    <div className="ml-auto text-sm text-muted-foreground">
                                      {toolsData?.tools?.total || 0} tool{(toolsData?.tools?.total || 0) !== 1 ? 's' : ''}
                                      {debouncedSearch || selectedCategory !== "all" ? ' found' : ' available'}.
                                    </div>
                                  </div>

                                  <div className="space-y-6">
                                    {/* New Agent Hierarchy View */}
                                    <AgentHierarchyView
                                      tools={filteredTools}
                                      enabledTools={enabledTools}
                                      onToggle={(tool, enabled) => {
                                        let updated = [...enabledTools];
                                        if (enabled) {
                                          const newToolConfig = {
                                            id: tool.id,
                                            type: tool.type,
                                            name: tool.name,
                                            config: tool.config?.map(configItem => ({
                                              name: configItem.name,
                                              variable: '',
                                              type: configItem.type
                                            })) || []
                                          };
                                          updated = [...enabledTools, newToolConfig];
                                          if (tool.config?.length > 0) {
                                            setSheetOpen(tool.id);
                                          }
                                        } else {
                                          updated = enabledTools.filter(t => t.id !== tool.id);
                                        }
                                        setEnabledTools(updated);
                                      }}
                                      onConfigUpdate={(toolId, value, name) => {
                                        const updated = enabledTools.map(et => {
                                          if (et.id === toolId) {
                                            return {
                                              ...et,
                                              config: et.config.map(c =>
                                                c.name === name ? { ...c, variable: value } : c
                                              )
                                            };
                                          }
                                          return et;
                                        });
                                        setEnabledTools(updated);
                                      }}
                                      sheetOpen={sheetOpen}
                                      setSheetOpen={setSheetOpen}
                                      variables={variables}
                                      renderConfigElement={(tool, config, update) => (
                                        <ToolConfigurationElement
                                          tool={tool}
                                          config={config}
                                          variables={variables}
                                          update={update}
                                        />
                                      )}
                                      skills={skillsData?.skillsPagination?.items || []}
                                      enabledSkills={enabledSkills}
                                      onSkillToggle={(skill, enabled) => {
                                        if (enabled) {
                                          setEnabledSkills(prev => [...prev, { id: skill.id, name: skill.name }]);
                                        } else {
                                          setEnabledSkills(prev => prev.filter(s => s.id !== skill.id));
                                        }
                                      }}
                                    />

                                    {/* Empty state when no tools match filters */}
                                    {filteredTools.length === 0 && (searchTerm || selectedCategory !== "all") && (
                                      <div className="text-center py-8">
                                        <div className="text-muted-foreground">
                                          No tools found matching your criteria.
                                        </div>
                                        <Button variant="outline" size="sm" className="mt-2" onClick={clearSearch}>
                                          Clear filters
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
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

      {/* Prompt Browser Sheet */}
      <PromptBrowserSheet
        open={isPromptBrowserOpen}
        onOpenChange={setIsPromptBrowserOpen}
        agentId={agent.id}
        agentName={agent.name}
        user={user}
        onUpdate={refetchPrompts}
      />
    </div>
  );
}

type Config = { name: string, variable: string | boolean | number, type: "string" | "number" | "boolean" | "variable" }

const ToolConfigurationElement = ({
  tool,
  update,
  config,
  variables
}: {
  tool: ExuluTool,
  update: (value: any, name: string) => void
  config: Config[]
  variables: any[]
}) => {
  return (<>
    {tool.config.map((configItem, configIndex) => {
      const configEntry = config.find(c => c.name === configItem.name);
      const currentValue = configEntry?.variable ?? '';

      if (configItem.name === "reranker") {
        return (
          <div key={configIndex} className="space-y-2 border rounded-md p-3">
            <div className="text-sm font-medium capitalize">
              {configItem.name.replace(/_/g, " ")}
            </div>
            {configItem.description && (
              <TextPreview text={configItem.description} sliceLength={200} />
            )}
            <RerankerSelector disabled={!configEntry} value={currentValue as string} onSelect={(value) => {
              update(value, configItem.name);
            }} />
          </div>
        );
      }

      switch (configItem.type) {
        case "string":
          /* Text area */
          return (
            <div key={configIndex} className="space-y-2 border rounded-md p-3">
              <div className="text-sm font-medium capitalize">
                {configItem.name.replace(/_/g, " ")}
              </div>
              {configItem.description && (
                <TextPreview text={configItem.description} sliceLength={200} />
              )}
              <Textarea
                disabled={!configEntry}
                value={(currentValue as string) || ''}
                onChange={(e) => {
                  update(e.target.value, configItem.name);
                }}
              />
            </div>
          );
        case "number":
          return (
            <div key={configIndex} className="space-y-2 border rounded-md p-3">
              <div className="text-sm font-medium capitalize">
                {configItem.name.replace(/_/g, " ")}
              </div>
              {configItem.description && (
                <TextPreview text={configItem.description} sliceLength={200} />
              )}
              <Input
                type="number"
                disabled={!configEntry}
                value={currentValue?.toString() || ''}
                onChange={(e) => {
                  update(Number(e.target.value), configItem.name);
                }}
              />
            </div>
          );
        case "boolean":
          return (
            <div key={configIndex} className="space-y-2 border rounded-md p-3">
              <div className="text-sm font-medium capitalize">
                {configItem.name.replace(/_/g, " ")}
              </div>
              {configItem.description && (
                <TextPreview text={configItem.description} sliceLength={200} />
              )}
              <Switch
                disabled={!configEntry}
                checked={currentValue === 'true' || currentValue === true || currentValue === 1}
                onCheckedChange={(value) => {
                  update(value ? 'true' : 'false', configItem.name);
                }}
              />
            </div>
          );
        default:
          return (
            <div key={configIndex} className="space-y-2 border rounded-md p-3">
              <div className="text-sm font-medium capitalize">
                {configItem.name.replace(/_/g, " ")}
              </div>
              {configItem.description && (
                <TextPreview text={configItem.description} sliceLength={200} />
              )}
              <VariableSelectionElement
                disabled={!configEntry}
                configItem={configItem}
                currentValue={currentValue}
                variables={variables}
                onVariableSelect={(variableName) => {
                  update(variableName, configItem.name);
                }}
              />
            </div>
          );
      }
    })}
  </>)
}