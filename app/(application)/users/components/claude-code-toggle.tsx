"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
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
import { GET_USERS, UPDATE_USER_BY_ID, GET_VARIABLES, GET_VARIABLE_BY_ID } from "@/queries/queries";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Variable {
  id: string;
  name: string;
  value: string;
  encrypted: boolean;
}

interface ClaudeCodeToggleProps {
  user: {
    id: string;
    anthropic_token?: string;
    [key: string]: any;
  };
}

export function ClaudeCodeToggle({ user }: ClaudeCodeToggleProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVariableId, setSelectedVariableId] = useState("");
  const [selectedVariableName, setSelectedVariableName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [updateUser] = useMutation(UPDATE_USER_BY_ID, {
    refetchQueries: [
      GET_USERS,
      "GetUsers",
    ],
  });

  const { data: variablesData, loading: variablesLoading } = useQuery(GET_VARIABLES, {
    variables: { page: 1, limit: 100 },
    skip: !isDialogOpen,
  });

  const { data: selectedVariableData } = useQuery(GET_VARIABLE_BY_ID, {
    variables: { id: selectedVariableId },
    skip: !selectedVariableId,
  });

  const variables: Variable[] = variablesData?.variablesPagination?.items || [];

  const hasClaudeCode = Boolean(user.anthropic_token);

  const handleToggleChange = (checked: boolean) => {
    if (checked) {
      // Show dialog to enter API key
      setIsDialogOpen(true);
    } else {
      // Remove Claude Code access
      handleRemoveClaudeCode();
    }
  };

  const handleRemoveClaudeCode = async () => {
    setIsLoading(true);
    try {
      await updateUser({
        variables: {
          id: user.id,
          anthropic_token: null,
        },
      });
      toast({
        title: "Claude Code Disabled",
        description: "Claude Code access has been removed for this user.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove Claude Code access.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedVariableId) {
      toast({
        title: "Error",
        description: "Please select a variable containing the Claude Code API key.",
        variant: "destructive",
      });
      return;
    }

    const variableValue = selectedVariableData?.variableById?.name;
    if (!variableValue) {
      toast({
        title: "Error",
        description: "Selected variable has no value.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await updateUser({
        variables: {
          id: user.id,
          anthropic_token: variableValue,
        },
      });
      
      setIsDialogOpen(false);
      setSelectedVariableId("");
      setSelectedVariableName("");
      toast({
        title: "Claude Code Enabled",
        description: `Claude Code access has been enabled using variable: ${selectedVariableName}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to enable Claude Code access.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setSelectedVariableId("");
    setSelectedVariableName("");
  };

  const handleCreateNewVariable = () => {
    router.push("/variables/create");
    setIsDialogOpen(false);
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <Switch
          checked={hasClaudeCode}
          onCheckedChange={handleToggleChange}
          disabled={isLoading}
          className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
        />
        <span className="text-sm text-muted-foreground">
          {hasClaudeCode ? "Enabled" : "Disabled"}
        </span>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[475px]">
          <DialogHeader>
            <DialogTitle>Enable Claude Code for {user.email}</DialogTitle>
            <DialogDescription>
              Select a variable containing the Claude Code API key for this user. The variable value will be used securely.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Claude Code API Key Variable</Label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    className="w-full justify-between"
                    disabled={variablesLoading}
                  >
                    {selectedVariableName || "Select variable..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search variables..." />
                    <CommandList>
                      <CommandEmpty>No variables found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={handleCreateNewVariable}
                          className="text-orange-600 font-medium"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create new variable
                        </CommandItem>
                        {variables.map((variable) => (
                          <CommandItem
                            key={variable.id}
                            onSelect={() => {
                              setSelectedVariableId(variable.id);
                              setSelectedVariableName(variable.name);
                              setPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedVariableId === variable.id ? "opacity-100" : "opacity-0"
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={isLoading || !selectedVariableId}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isLoading ? "Confirming..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}