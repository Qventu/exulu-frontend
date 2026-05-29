"use client";

import { useContext, useEffect, useState } from "react";
import { useMutation } from "@apollo/client";
import { UserContext } from "@/app/(application)/authenticated";
import { UPDATE_USER_BY_ID } from "@/queries/queries";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const { user } = useContext(UserContext);
  const { toast } = useToast();

  const [personalPrompt, setPersonalPrompt] = useState<string>(
    user?.personal_system_prompt ?? "",
  );

  useEffect(() => {
    setPersonalPrompt(user?.personal_system_prompt ?? "");
  }, [user?.id]);

  const [updateUser, { loading }] = useMutation(UPDATE_USER_BY_ID, {
    onCompleted: () => {
      toast({
        title: "Settings saved",
        description: "Your personal system prompt has been updated.",
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: "Could not save",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const onSave = () => {
    if (!user?.id) return;
    updateUser({
      variables: {
        id: user.id,
        personal_system_prompt: personalPrompt,
      },
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your personal preferences.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal system prompt</CardTitle>
            <CardDescription>
              Tell the assistant anything you'd like it to know about you across
              every conversation — your role, communication style, preferred
              response length, languages you work in, anything. This is appended
              to the system prompt of every chat you start.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={personalPrompt}
              onChange={(e) => setPersonalPrompt(e.target.value)}
              placeholder="e.g. I'm a backend engineer working in TypeScript. Keep responses concise and skip preamble."
              rows={10}
              className="resize-y"
            />
            <div className="flex justify-end">
              <Button onClick={onSave} disabled={loading || !user?.id}>
                {loading ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
