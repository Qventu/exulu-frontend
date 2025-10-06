"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@apollo/client";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CREATE_EVAL_SET } from "@/queries/queries";
interface CreateEvalSetModalProps {
  onSuccess: () => void;
}

export function CreateEvalSetModal({
  onSuccess,
}: CreateEvalSetModalProps) {
  console.log("CreateEvalSetModal rendered.");
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");

  const [createEvalSet, { loading }] = useMutation(CREATE_EVAL_SET, {
    onCompleted: (data: any) => {
      console.log("Mutation completed:", data);
     
      setName("");
      setDescription("");
      onSuccess();
      setOpen(false);
    },
    onError: (error: any) => {
      console.log("Mutation error:", error);
   
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="ml-auto h-8">
          <Plus className="mr-2 h-4 w-4" />
          New Eval Set
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create Eval Set</DialogTitle>
          <DialogDescription>
            Create a new evaluation set. You can add test cases after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e: any) => {
          e.preventDefault();
          createEvalSet({
            variables: {
              data: {
                name: name.trim(),
                description: description.trim() || null,
              },
            },
          });
        }}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Customer Support Scenarios"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this eval set tests..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Eval Set
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
