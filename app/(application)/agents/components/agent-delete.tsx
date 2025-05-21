import { Trash2 } from "lucide-react";
import { useState } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";

export function AgentDelete({
  deleteAgent,
  deleteAgentResult,
  agent,
}) {

  const confirmation = "delete this agent";
  const [value, setValue] = useState("");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!agent?.id} variant="destructive">
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[475px]">
        <DialogHeader>
          <DialogTitle>Delete this agent</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Type "{confirmation}" to confirm</Label>
            <Input
              onChange={(e) => {
                setValue(e.target.value);
              }}
              id="name"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={value !== confirmation || deleteAgentResult.loading}
            onClick={() => {
              deleteAgent({
                variables: {
                  id: agent.id,
                },
              });
            }}
            variant={"destructive"}
            type="submit"
          >
            Delete {deleteAgentResult.loading && <Loading />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
