import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Lightbulb, Check, ChevronsUpDown } from "lucide-react";
import { PromptLibrary } from "@/types/models/prompt-library";
import { UserWithRole } from "@/types/models/user";
import { useCreatePrompt, useUpdatePrompt } from "@/hooks/use-prompts";
import { extractVariables, validatePromptVariables } from "@/lib/prompts";
import { RBACControl } from "@/components/rbac";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@apollo/client";
import { GET_AGENTS } from "@/queries/queries";
import { cn } from "@/lib/utils";

interface PromptEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: PromptLibrary;
  onSuccess: () => void;
  user: UserWithRole;
  defaultAssignedAgents?: string[];
}

export function PromptEditorModal({
  open,
  onOpenChange,
  prompt,
  onSuccess,
  user,
  defaultAssignedAgents = [],
}: PromptEditorModalProps) {
  const isEditing = !!prompt;
  const [createPrompt, { loading: creating }] = useCreatePrompt();
  const [updatePrompt, { loading: updating }] = useUpdatePrompt();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [rightsMode, setRightsMode] = useState<
    "private" | "users" | "roles" | "public" | "projects"
  >("private");
  const [rbacUsers, setRbacUsers] = useState<
    { id: number; rights: "read" | "write" }[]
  >([]);
  const [rbacRoles, setRbacRoles] = useState<
    { id: string; rights: "read" | "write" }[]
  >([]);
  const [rbacProjects, setRbacProjects] = useState<
    { id: string; rights: "read" | "write" }[]
  >([]);
  const [rbacOpen, setRbacOpen] = useState(false);
  const [assignedAgents, setAssignedAgents] = useState<string[]>([]);
  const [agentSelectorOpen, setAgentSelectorOpen] = useState(false);

  // Fetch agents
  const { data: agentsData } = useQuery(GET_AGENTS, {
    variables: { page: 1, limit: 100 },
  });

  const agents = agentsData?.agentsPagination?.items || [];

  // Extract variables from content
  const variables = extractVariables(content);
  const { isValid, invalidVariables } = validatePromptVariables(content);

  // Initialize form when editing
  useEffect(() => {
    if (!open) return; // Only run when modal opens

    if (prompt) {
      setName(prompt.name);
      setDescription(prompt.description || "");
      setContent(prompt.content);
      setRightsMode(prompt.rights_mode);
      setRbacUsers(prompt.RBAC?.users || []);
      setRbacRoles(prompt.RBAC?.roles || []);
      setRbacProjects(prompt.RBAC?.projects || []);
      setAssignedAgents(prompt.assigned_agents || []);
    } else {
      resetForm();
      // Apply default assigned agents when creating new prompt
      if (defaultAssignedAgents && defaultAssignedAgents.length > 0) {
        setAssignedAgents(defaultAssignedAgents);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, open]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setContent("");
    setRightsMode("private");
    setRbacUsers([]);
    setRbacRoles([]);
    setRbacProjects([]);
    setRbacOpen(false);
    setAssignedAgents([]);
  };

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      toast.error("Please enter a name for the prompt");
      return;
    }
    if (!content.trim()) {
      toast.error("Please enter prompt content");
      return;
    }
    if (!isValid) {
      toast.error(
        `Invalid variable names: ${invalidVariables.join(", ")}. Use only letters, numbers, and underscores.`
      );
      return;
    }

    try {
      const input = {
        name: name.trim(),
        description: description.trim() || undefined,
        content: content.trim(),
        rights_mode: rightsMode,
        RBAC:
          rightsMode !== "private" && rightsMode !== "public"
            ? {
                users: rbacUsers.length > 0 ? rbacUsers : undefined,
                roles: rbacRoles.length > 0 ? rbacRoles : undefined,
                projects: rbacProjects.length > 0 ? rbacProjects : undefined,
              }
            : undefined,
        assigned_agents: assignedAgents.length > 0 ? assignedAgents : undefined,
      };

      if (isEditing) {
        await updatePrompt({
          variables: {
            id: prompt.id,
            ...input,
          },
        });
        toast.success("Prompt updated successfully");
      } else {
        await createPrompt({
          variables: input,
        });
        toast.success("Prompt created successfully");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error(isEditing ? "Failed to update prompt" : "Failed to create prompt");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Prompt" : "Create New Prompt"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your prompt template"
              : "Create a reusable prompt template with variables"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Customer Support Template"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Brief description of this prompt"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">
              Prompt Content <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="content"
              placeholder="You are helping {{customer_name}} with their {{issue}}..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Use{" "}
                <code className="bg-muted px-1 py-0.5 rounded">
                  {"{"}
                  {"{"}variable_name{"}}"}
                </code>{" "}
                format for dynamic content. Variable names can only contain letters,
                numbers, and underscores.
              </span>
            </div>

            {/* Detected Variables */}
            {variables.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                <span className="text-xs text-muted-foreground mr-2">
                  Detected variables:
                </span>
                {variables.map((variable) => (
                  <Badge key={variable} variant="outline" className="text-xs">
                    {variable}
                  </Badge>
                ))}
              </div>
            )}

            {/* Invalid Variables Warning */}
            {!isValid && (
              <div className="text-xs text-destructive">
                Invalid variable names: {invalidVariables.join(", ")}
              </div>
            )}
          </div>

          {/* Assign to Agents */}
          <div className="space-y-2">
            <Label>Assign to Agents</Label>
            <Popover modal={true} open={agentSelectorOpen} onOpenChange={setAgentSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={agentSelectorOpen}
                  className="w-full justify-between"
                >
                  {assignedAgents.length === 0
                    ? "Select agents..."
                    : `${assignedAgents.length} agent${assignedAgents.length !== 1 ? "s" : ""} selected`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search agents..." />
                  <CommandList>
                    <CommandEmpty>No agents found.</CommandEmpty>
                    <CommandGroup>
                      {agents.map((agent: any) => (
                        <CommandItem
                          key={agent.id}
                          value={agent.id}
                          onSelect={() => {
                            setAssignedAgents((prev) =>
                              prev.includes(agent.id)
                                ? prev.filter((id) => id !== agent.id)
                                : [...prev, agent.id]
                            );
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              assignedAgents.includes(agent.id)
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {agent.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {assignedAgents.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {assignedAgents.map((agentId) => {
                  const agent = agents.find((a: any) => a.id === agentId);
                  return agent ? (
                    <Badge key={agentId} variant="secondary" className="text-sm">
                      {agent.name}
                      <button
                        type="button"
                        onClick={() =>
                          setAssignedAgents((prev) =>
                            prev.filter((id) => id !== agentId)
                          )
                        }
                        className="ml-1.5 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Assign this prompt to specific agents to show it as recommended in chat
            </p>
          </div>

          {/* RBAC Control */}
          <Collapsible open={rbacOpen} onOpenChange={setRbacOpen}>
            <div className="space-y-2">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  Access Control
                  <span className="text-xs text-muted-foreground">
                    {rightsMode === "private" && "Private"}
                    {rightsMode === "public" && "Public"}
                    {rightsMode === "users" && `${rbacUsers.length} users`}
                    {rightsMode === "roles" && `${rbacRoles.length} roles`}
                    {rightsMode === "projects" && `${rbacProjects.length} projects`}
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <RBACControl
                  initialRightsMode={rightsMode}
                  initialUsers={rbacUsers}
                  initialRoles={rbacRoles}
                  modalMode={true}
                  initialProjects={rbacProjects}
                  onChange={(mode, users, roles, projects) => {
                    setRightsMode(mode);
                    setRbacUsers(users);
                    setRbacRoles(roles);
                    setRbacProjects(projects);
                  }}
                />
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={creating || updating || !name.trim() || !content.trim() || !isValid}
          >
            {creating || updating ? "Saving..." : isEditing ? "Save Changes" : "Create Prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
