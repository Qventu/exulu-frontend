import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Trash2 } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {Context} from "@EXULU_SHARED/models/context";

export function DeleteEmbeddings({
  context,
  backend,
  disabled,
  onDelete,
}: {
  context: Context;
  backend: string | null;
  disabled: boolean;
  onDelete: any;
}) {
  const [loading, setLoading] = useState(false);
  const [string, setString] = useState("");
  const [open, setOpen] = useState(false);

  const targetString = "delete";

  const handleRun = async () => {
    setLoading(true);

    if (!context?.id) {
      console.error("Missing context id");
      return;
    }

    if (!backend) {
      console.error("Missing backend");
      return;
    }

    try {
      /* const response: any = await embedders.delete.all(context.id); // todo fix
      const data = await response.json(); */
      setLoading(false);
      if (onDelete) {
        onDelete();
      }
      setOpen(false);
    } catch (e) {
      setLoading(false);
      console.error(e);
      // todo: show error message toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={"outline"} disabled={!context || disabled}>
          Delete embeddings <Trash2 className="size-4 ml-2 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[475px]">
        <DialogHeader>
          <DialogTitle>Delete embeddings</DialogTitle>
          <DialogDescription>
            This will delete all embeddings for the <b>{context.name}</b>{" "}
            context.
          </DialogDescription>
          <Alert variant="default">
            <ExclamationTriangleIcon className="size-4" />
            <AlertTitle>This can't be undone</AlertTitle>
            <AlertDescription>
              Once these embeddings are deleted, you will need to generate them
              again if you want to use this context in retrieval.
            </AlertDescription>
          </Alert>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Confirm by typing "{targetString}"</Label>
            <Input
              onChange={(e) => {
                setString(e.target.value);
              }}
              id="name"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              handleRun();
            }}
            disabled={loading || string !== targetString}
            variant={"destructive"}
            type="submit"
          >
            Delete embeddings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
