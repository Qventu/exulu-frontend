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
  REMOVE_AGENT_BY_ID, UPDATE_AGENT_BY_ID, GET_AGENT_BY_ID, CREATE_AGENT_SESSION, GET_VARIABLES,
  GET_TOOLS, GET_TOOL_CATEGORIES,
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
import { Agent } from "@EXULU_SHARED//models/agent";
import { UserContext } from "@/app/(application)/authenticated";
import { Tool } from "@EXULU_SHARED/models/tool";
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
import { Check, ChevronsUpDown, Wrench, Image, FileText, Volume2, Video, Info, AlertCircle, Settings, Text, Search, X } from "lucide-react";
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
const ToolConfigItem = ({
  configItem,
  currentValue,
  variables,
  onVariableSelect
}: {
  configItem: { name: string; description: string; default?: string },
  currentValue: string,
  variables: any[],
  onVariableSelect: (variableName: string) => void
}) => {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const selectedVariable = variables.find((v: any) => v.name === currentValue);

  return (
    <div className="space-y-2">
      <div className="text-sm">
        <div className="font-medium capitalize">{configItem.name}</div>
        <div className="text-muted-foreground text-xs capitalize">{configItem.description}</div>
      </div>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={popoverOpen}
            className="w-full justify-between text-sm"
          >
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
                <TextPreview text={configItem.default} sliceLength={200} />
              </CardContent>
            </Card>
          )
        }
      </Popover>
    </div>
  );
};

const agentFormSchema = z.object({
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
  providerapikey: z.string().nullable().optional(),
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
  refetch,
}: {
  agent: Agent;
  refetch: any;
}) {

  const router = useRouter();
  const { user } = useContext(UserContext);
  const configContext = useContext(ConfigContext);
  const [enabledTools, setEnabledTools] = useState<{ id: string, config: { name: string, variable: string }[] }[]>(
    // Convert legacy string[] format to new object format
    agent.tools ? agent.tools : []
  )
  const [sheetOpen, setSheetOpen] = useState<boolean | string>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);
  const [providerapikey, setProviderapikey] = useState<string>(agent.providerapikey || '')
  const [firewallEnabled, setFirewallEnabled] = useState<boolean>(agent.firewall?.enabled || false)
  const [animation_idle, setAnimation_idle] = useState<string>(agent.animation_idle || '')
  const [animation_responding, setAnimation_responding] = useState<string>(agent.animation_responding || '')
  const [rbac, setRbac] = useState({
    rights_mode: agent.rights_mode,
    users: agent.RBAC?.users,
    roles: agent.RBAC?.roles,
    projects: agent.RBAC?.projects
  })
  const [firewallScanners, setFirewallScanners] = useState({
    promptGuard: agent.firewall?.scanners?.promptGuard || false,
    codeShield: agent.firewall?.scanners?.codeShield || false,
    agentAlignment: agent.firewall?.scanners?.agentAlignment || false,
    hiddenAscii: agent.firewall?.scanners?.hiddenAscii || false,
    piiDetection: agent.firewall?.scanners?.piiDetection || false,
  })

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
      items: Tool[]
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

  const { data: categoriesData } = useQuery<{
    toolCategories: string[]
  }>(GET_TOOL_CATEGORIES);

  const variables = variablesData?.variablesPagination?.items || [];

  // Filter out agent's own tool and group by category
  const filteredTools = useMemo(() => {
    return toolsData?.tools?.items?.filter((tool: Tool) => tool.id !== agent.id) || [];
  }, [toolsData?.tools?.items, agent.id]);

  // Group tools by category for organized display
  const toolsByCategory = useMemo(() => {
    return filteredTools.reduce((acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category].push(tool);
      return acc;
    }, {} as Record<string, Tool[]>);
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
      name: "New agent",
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

  const [createAgentSession] = useMutation(
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
                      description: data.description,
                      instructions: data.instructions,
                      category: data.category,
                      active: data.active,
                      providerapikey: providerapikey,
                      animation_idle: animation_idle,
                      animation_responding: animation_responding,
                      rights_mode: rbac.rights_mode,
                      RBAC: {
                        users: rbac.users || [],
                        roles: rbac.roles || [],
                        projects: rbac.projects || []
                      },
                      firewall: JSON.stringify({
                        enabled: firewallEnabled,
                        scanners: firewallScanners
                      }),
                      tools: JSON.stringify(enabledTools)
                    },
                  });
                  refetch();
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
        </div>
      </div>
      <Separator />
      <Tabs defaultValue="complete" className="flex-1">
        <div className="container py-6">
          <div className="grid items-stretch gap-6">
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
                                              rows={10}
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
                                  <FormField
                                    control={agentForm.control}
                                    name={`instructions`}
                                    render={({ field }: any) => {
                                      if (!field.value) {
                                        field.value = "";
                                      }
                                      return (
                                        <FormItem>
                                          <FormLabel>Instructions</FormLabel>
                                          <FormControl>
                                            <Textarea
                                              rows={10}
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
                                  <div className="space-y-2">
                                    <div className="text-sm">
                                      <div className="font-medium">Provider API Key</div>
                                      <div className="text-muted-foreground text-xs">Select a variable containing the API key for the provider</div>
                                    </div>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          role="combobox"
                                          className="w-full justify-between text-sm"
                                        >
                                          {variables.find((v: any) => v.name === providerapikey)?.name || "Select variable..."}
                                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-full p-0 z-[9999]">
                                        <Command>
                                          <CommandInput placeholder="Search variables..." />
                                          <CommandList>
                                            <CommandEmpty>No variables found.</CommandEmpty>
                                            <CommandGroup>
                                              {variables.map((variable: any) => (
                                                <CommandItem
                                                  key={variable.id}
                                                  onSelect={() => {
                                                    setProviderapikey(variable.name);
                                                  }}
                                                >
                                                  <Check
                                                    className={cn(
                                                      "mr-2 h-4 w-4",
                                                      providerapikey === variable.name ? "opacity-100" : "opacity-0"
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
                                    </Popover>
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium mb-2">Modalities</div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      This agent uses <b>{agent.modelName}</b> from <b>{agent.providerName}</b> and can use the following capabilities:
                                    </p>
                                    <TooltipProvider>
                                      <div className="flex items-center gap-3 mt-2">
                                        <div className={`p-2 rounded-md ${agent.capabilities?.text ? 'bg-primary text-primary-foreground' : 'bg-gray-500 text-white'}`}>
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
                                  </div>


                                  <>
                                    <div className="text-sm font-medium mb-0">    You can test this agent using the Exulu
                                      UI without activating the agent if you
                                      are a super admin:</div>
                                    <Button
                                      className="mt-0"
                                      onClick={async () => {
                                        console.log("agent", agent)
                                        const result = await createAgentSession({
                                          variables: {
                                            title: "New session",
                                            user: user.id,
                                            agent: agent.id,
                                          }
                                        })
                                        console.log("result", result)
                                        const sessionId = result?.data?.agent_sessionsCreateOne?.item?.id
                                        router.push(
                                          `/chat/${agent.id}/${sessionId}`,
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

                            {configContext?.fileUploads?.s3endpoint && (
                              <Card className="bg-transparent">
                                <Collapsible>
                                  <CardHeader className="p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex flex-col">
                                        <p className="text-base">
                                          Custom Animations
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
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Idle Animation */}
                                        <div className="space-y-2">
                                          <div>
                                            <div className="text-sm font-medium">Idle Animation</div>
                                            <div className="text-xs text-muted-foreground">Animation when agent is waiting</div>
                                          </div>

                                          <FileDataCard s3key={animation_idle}>
                                            <UppyDashboard
                                              id="agent-idle-animation"
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
                                      initialProjects={agent.RBAC?.projects}
                                      onChange={(rights_mode, users, roles, projects) => {
                                        setRbac({
                                          rights_mode,
                                          users,
                                          roles,
                                          projects
                                        })
                                      }}
                                    />
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </Card>
                            <FormField
                              control={agentForm.control}
                              name="firewall.enabled"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">
                                      LLM Firewall Protection
                                    </FormLabel>
                                    <FormDescription>
                                      Enable firewall to protect against malicious inputs and outputs.
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={firewallEnabled}
                                      onCheckedChange={(value) => {
                                        setFirewallEnabled(value)
                                        field.onChange(value)
                                      }}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            {firewallEnabled && (
                              <Card>
                                <CardHeader>
                                  <CardTitle>Firewall Scanner Configuration</CardTitle>
                                  <CardDescription>
                                    Configure which security scanners to enable for different types of threats.
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">
                                        Prompt Guard
                                      </FormLabel>
                                      <FormDescription>
                                        Detects and blocks prompt injection attacks.
                                      </FormDescription>
                                    </div>
                                    <Switch
                                      checked={firewallScanners.promptGuard}
                                      onCheckedChange={(value) => {
                                        setFirewallScanners(prev => ({ ...prev, promptGuard: value }))
                                      }}
                                    />
                                  </div>

                                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">
                                        Code Shield
                                      </FormLabel>
                                      <FormDescription>
                                        Prevents generation of malicious code or exploits.
                                      </FormDescription>
                                    </div>
                                    <Switch
                                      checked={firewallScanners.codeShield}
                                      onCheckedChange={(value) => {
                                        setFirewallScanners(prev => ({ ...prev, codeShield: value }))
                                      }}
                                    />
                                  </div>

                                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">
                                        Agent Alignment
                                      </FormLabel>
                                      <FormDescription>
                                        Ensures responses align with safety guidelines and policies.
                                      </FormDescription>
                                    </div>
                                    <Switch
                                      checked={firewallScanners.agentAlignment}
                                      onCheckedChange={(value) => {
                                        setFirewallScanners(prev => ({ ...prev, agentAlignment: value }))
                                      }}
                                    />
                                  </div>

                                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">
                                        Hidden ASCII Detection
                                      </FormLabel>
                                      <FormDescription>
                                        Detects hidden or malformed characters that could bypass other filters.
                                      </FormDescription>
                                    </div>
                                    <Switch
                                      checked={firewallScanners.hiddenAscii}
                                      onCheckedChange={(value) => {
                                        setFirewallScanners(prev => ({ ...prev, hiddenAscii: value }))
                                      }}
                                    />
                                  </div>

                                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">
                                        PII Detection
                                      </FormLabel>
                                      <FormDescription>
                                        Identifies and protects personally identifiable information.
                                      </FormDescription>
                                    </div>
                                    <Switch
                                      checked={firewallScanners.piiDetection}
                                      onCheckedChange={(value) => {
                                        setFirewallScanners(prev => ({ ...prev, piiDetection: value }))
                                      }}
                                    />
                                  </div>
                                </CardContent>
                              </Card>
                            )}


                          </div>
                        </div>
                        <div className="col">

                          <Card>
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
                                      <Button variant="outline" size="sm" onClick={clearSearch}>
                                        Clear filters
                                      </Button>
                                    )}

                                    <div className="ml-auto text-sm text-muted-foreground">
                                      {toolsData?.tools?.total || 0} tool{(toolsData?.tools?.total || 0) !== 1 ? 's' : ''}
                                      {debouncedSearch || selectedCategory !== "all" ? ' found' : ' available'}
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-6">
                                  {/* Show tools grouped by category */}
                                  {selectedCategory === "all" ? (
                                    // Group view: show each category as a collapsible section
                                    Object.entries(toolsByCategory).map(([categoryName, categoryTools]) => {
                                      const enabledInCategory = categoryTools.filter(tool =>
                                        enabledTools.some(et => et.id === tool.id)
                                      ).length;

                                      const isCollapsed = collapsedCategories.has(categoryName);

                                      return (
                                        <Collapsible key={categoryName} open={!isCollapsed} onOpenChange={() => toggleCategoryCollapse(categoryName)}>
                                          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                            <CollapsibleTrigger asChild>
                                              <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto font-medium">
                                                <ChevronsUpDown className="h-4 w-4" />
                                                <span className="capitalize">{categoryName}</span>
                                                <Badge variant="secondary" className="text-xs">
                                                  {enabledInCategory}/{categoryTools.length}
                                                </Badge>
                                              </Button>
                                            </CollapsibleTrigger>

                                            <div className="flex items-center gap-2">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  // Bulk enable all tools in this category
                                                  const newlyEnabled = categoryTools
                                                    .filter(tool => !enabledTools.some(et => et.id === tool.id))
                                                    .map(tool => ({
                                                      id: tool.id,
                                                      type: tool.type,
                                                      config: tool.config?.map(configItem => ({
                                                        name: configItem.name,
                                                        variable: ''
                                                      })) || []
                                                    }));
                                                  setEnabledTools([...enabledTools, ...newlyEnabled]);
                                                }}
                                                disabled={enabledInCategory === categoryTools.length}
                                              >
                                                Enable All
                                              </Button>

                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  // Bulk disable all tools in this category
                                                  const categoryToolIds = categoryTools.map(t => t.id);
                                                  const filtered = enabledTools.filter(et => !categoryToolIds.includes(et.id));
                                                  setEnabledTools(filtered);
                                                }}
                                                disabled={enabledInCategory === 0}
                                              >
                                                Disable All
                                              </Button>
                                            </div>
                                          </div>

                                          <CollapsibleContent className="mt-2">
                                            <div className="space-y-2 pl-4">
                                              {categoryTools.map((tool: Tool) => {
                                                const isEnabled = enabledTools.some(et => et.id === tool.id);
                                                const toolConfig = enabledTools.find(et => et.id === tool.id);
                                                const requiredConfigCount = tool.config?.length || 0;
                                                const filledConfigCount = toolConfig?.config?.filter(c => c.variable && c.variable.trim() !== '').length || 0;
                                                const hasEmptyConfigs = isEnabled && requiredConfigCount > 0 && filledConfigCount < requiredConfigCount;

                                                return (
                                                  <div key={tool?.id} className="rounded-lg border p-4">
                                                    <div className="flex items-center justify-between">
                                                      <div className="flex items-center flex-1">
                                                        <div className="flex-1">
                                                          <div className="flex items-center gap-2">
                                                            <div className="font-medium">{tool?.name}</div>
                                                            <div className="flex items-center gap-1">
                                                              {
                                                                requiredConfigCount > 0 && isEnabled && <>
                                                                  <Badge variant="secondary" className="text-xs">
                                                                    {filledConfigCount}/{requiredConfigCount}
                                                                  </Badge>
                                                                  {hasEmptyConfigs && (
                                                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                                                  )}
                                                                </>
                                                              }
                                                              <Badge variant={"outline"}>{tool?.category}</Badge>
                                                            </div>
                                                          </div>
                                                          <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                                            {tool?.description}
                                                          </div>
                                                        </div>
                                                        <Sheet open={sheetOpen === tool.id} onOpenChange={() => {
                                                          if (sheetOpen === tool.id) {
                                                            setSheetOpen(false);
                                                          } else {
                                                            setSheetOpen(tool.id);
                                                          }
                                                        }}>
                                                          {
                                                            (requiredConfigCount > 0 && !isEnabled) ? <SheetTrigger asChild>
                                                              <Button variant="ghost" size="sm">
                                                                <Settings className="h-4 w-4" />
                                                              </Button>
                                                            </SheetTrigger> : <Button type="button" disabled={true} variant="ghost" size="sm">
                                                              <Settings className="h-4 w-4" />
                                                            </Button>
                                                          }

                                                          <SheetTrigger asChild>
                                                            <Button className="mr-2" variant="ghost" size="sm">
                                                              <Info className="h-4 w-4" />
                                                            </Button>
                                                          </SheetTrigger>
                                                          <SheetContent className="w-[400px] sm:w-[540px]">
                                                            <SheetHeader>
                                                              <SheetTitle>{tool?.name}</SheetTitle>
                                                              <SheetDescription>
                                                                {tool?.description}
                                                              </SheetDescription>
                                                            </SheetHeader>
                                                            <div className="py-6">
                                                              <div className="space-y-4">
                                                                {/* Tool Configuration in Sheet */}
                                                                {tool.config && tool.config.length > 0 && (
                                                                  <div className="space-y-4">
                                                                    <div className="text-md font-medium">Configuration variables:</div>
                                                                    {tool.config.map((configItem, configIndex) => {
                                                                      const currentValue = toolConfig?.config.find(c => c.name === configItem.name)?.variable || '';
                                                                      return (
                                                                        <div key={configIndex} className="space-y-2">
                                                                          {isEnabled ? (
                                                                            <ToolConfigItem
                                                                              configItem={configItem}
                                                                              currentValue={currentValue}
                                                                              variables={variables}
                                                                              onVariableSelect={(variableName) => {
                                                                                const updated = enabledTools.map(et => {
                                                                                  if (et.id === tool.id) {
                                                                                    return {
                                                                                      ...et,
                                                                                      config: et.config.map(c =>
                                                                                        c.name === configItem.name
                                                                                          ? { ...c, variable: variableName }
                                                                                          : c
                                                                                      )
                                                                                    };
                                                                                  }
                                                                                  return et;
                                                                                });
                                                                                console.log("updated", updated)
                                                                                setEnabledTools(updated);
                                                                              }}
                                                                            />
                                                                          ) : (
                                                                            <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                                                                              Enable this tool to configure
                                                                            </div>
                                                                          )}
                                                                        </div>
                                                                      );
                                                                    })}
                                                                  </div>
                                                                )}
                                                              </div>
                                                            </div>
                                                          </SheetContent>
                                                        </Sheet>
                                                      </div>
                                                      <Switch
                                                        checked={isEnabled}
                                                        onCheckedChange={(value) => {
                                                          let updated = [...enabledTools];
                                                          if (value) {
                                                            // Add tool with empty config initially
                                                            const newToolConfig = {
                                                              id: tool.id,
                                                              type: tool.type,
                                                              config: tool.config?.map(configItem => ({
                                                                name: configItem.name,
                                                                variable: ''
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
                                                      />
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </CollapsibleContent>
                                        </Collapsible>
                                      );
                                    })
                                  ) : (
                                    // Filtered view: show tools in selected category only
                                    <div className="space-y-2">
                                      {filteredTools.map((tool: Tool) => {
                                        const isEnabled = enabledTools.some(et => et.id === tool.id);
                                        const toolConfig = enabledTools.find(et => et.id === tool.id);
                                        const requiredConfigCount = tool.config?.length || 0;
                                        const filledConfigCount = toolConfig?.config?.filter(c => c.variable && c.variable.trim() !== '').length || 0;
                                        const hasEmptyConfigs = isEnabled && requiredConfigCount > 0 && filledConfigCount < requiredConfigCount;

                                        return (
                                          <div key={tool?.id} className="rounded-lg border p-4">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center flex-1">
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-2">
                                                    <div className="font-medium">{tool?.name}</div>
                                                    <div className="flex items-center gap-1">
                                                      {
                                                        requiredConfigCount > 0 && isEnabled && <>
                                                          <Badge variant="secondary" className="text-xs">
                                                            {filledConfigCount}/{requiredConfigCount}
                                                          </Badge>
                                                          {hasEmptyConfigs && (
                                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                                          )}
                                                        </>
                                                      }
                                                      <Badge variant={"outline"}>{tool?.category}</Badge>
                                                    </div>
                                                  </div>
                                                  <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                                    {tool?.description}
                                                  </div>
                                                </div>
                                                <Sheet open={sheetOpen === tool.id} onOpenChange={() => {
                                                  if (sheetOpen === tool.id) {
                                                    setSheetOpen(false);
                                                  } else {
                                                    setSheetOpen(tool.id);
                                                  }
                                                }}>
                                                  {
                                                    (requiredConfigCount > 0 && !isEnabled) ? <SheetTrigger asChild>
                                                      <Button variant="ghost" size="sm">
                                                        <Settings className="h-4 w-4" />
                                                      </Button>
                                                    </SheetTrigger> : <Button type="button" disabled={true} variant="ghost" size="sm">
                                                      <Settings className="h-4 w-4" />
                                                    </Button>
                                                  }

                                                  <SheetTrigger asChild>
                                                    <Button className="mr-2" variant="ghost" size="sm">
                                                      <Info className="h-4 w-4" />
                                                    </Button>
                                                  </SheetTrigger>
                                                  <SheetContent className="w-[400px] sm:w-[540px]">
                                                    <SheetHeader>
                                                      <SheetTitle>{tool?.name}</SheetTitle>
                                                      <SheetDescription>
                                                        {tool?.description}
                                                      </SheetDescription>
                                                    </SheetHeader>
                                                    <div className="py-6">
                                                      <div className="space-y-4">
                                                        {/* Tool Configuration in Sheet */}
                                                        {tool.config && tool.config.length > 0 && (
                                                          <div className="space-y-4">
                                                            <div className="text-md font-medium">Configuration variables:</div>
                                                            {tool.config.map((configItem, configIndex) => {
                                                              const currentValue = toolConfig?.config.find(c => c.name === configItem.name)?.variable || '';
                                                              return (
                                                                <div key={configIndex} className="space-y-2">
                                                                  {isEnabled ? (
                                                                    <ToolConfigItem
                                                                      configItem={configItem}
                                                                      currentValue={currentValue}
                                                                      variables={variables}
                                                                      onVariableSelect={(variableName) => {
                                                                        const updated = enabledTools.map(et => {
                                                                          if (et.id === tool.id) {
                                                                            return {
                                                                              ...et,
                                                                              config: et.config.map(c =>
                                                                                c.name === configItem.name
                                                                                  ? { ...c, variable: variableName }
                                                                                  : c
                                                                              )
                                                                            };
                                                                          }
                                                                          return et;
                                                                        });
                                                                        console.log("updated", updated)
                                                                        setEnabledTools(updated);
                                                                      }}
                                                                    />
                                                                  ) : (
                                                                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                                                                      Enable this tool to configure
                                                                    </div>
                                                                  )}
                                                                </div>
                                                              );
                                                            })}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </SheetContent>
                                                </Sheet>
                                              </div>
                                              <Switch
                                                checked={isEnabled}
                                                onCheckedChange={(value) => {
                                                  let updated = [...enabledTools];
                                                  if (value) {
                                                    // Add tool with empty config initially
                                                    const newToolConfig = {
                                                      id: tool.id,
                                                      type: tool.type,
                                                      config: tool.config?.map(configItem => ({
                                                        name: configItem.name,
                                                        variable: ''
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
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

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
