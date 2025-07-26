"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { GET_USERS, UPDATE_USER_BY_ID } from "@/queries/queries";

interface ClaudeCodeToggleProps {
  user: {
    id: string;
    anthropic_token?: string;
    [key: string]: any;
  };
}

export function ClaudeCodeToggle({ user }: ClaudeCodeToggleProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [updateUser] = useMutation(UPDATE_USER_BY_ID, {
    refetchQueries: [
      GET_USERS,
      "GetUsers",
    ],
  });

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
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Claude Code API key.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await updateUser({
        variables: {
          id: user.id,
          anthropic_token: apiKey,
        },
      });
      
      setIsDialogOpen(false);
      setApiKey("");
      toast({
        title: "Claude Code Enabled",
        description: "Claude Code access has been enabled for this user.",
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
    setApiKey("");
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
            <DialogTitle>Enable Claude Code for {user.email}.</DialogTitle>
            <DialogDescription>
              Enter the Claude Code API key for this user. The key will be encrypted and stored securely.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="apiKey">Claude Code API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={isLoading || !apiKey.trim()}
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