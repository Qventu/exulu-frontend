import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

export function GenerateEmbeddings({
  context,
  backend,
    disabled
}: {
  context: Context;
  backend: string | null;
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false);
  const [string, setString] = useState("");
  const router = useRouter();
  const handleRun = async () => {
    setLoading(true);

    if (!backend) {
      console.error("Missing backend");
      return;
    }

    if (!context?.id) {
      console.error("Missing context id");
      return;
    }

    try {
      /* const response: any = await embedders.create(context.id, backend);
      const data = await response.json(); */
      setLoading(false);
      router.push("/jobs");
    } catch (e) {
      setLoading(false);
      console.error(e);
      // todo: show error message toast
    }
  };

  const targetString = "embed";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!context || disabled}>
          Generate embeddings for this context
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[475px]">
        <DialogHeader>
          <DialogTitle>What it does?</DialogTitle>
          <DialogDescription>
            This will start generating embeddings using the data you added to
            this particular Exulu context.
          </DialogDescription>
          <Alert variant="default">
            <ExclamationTriangleIcon className="size-4" />
            <AlertTitle>
              Token usage <Badge variant={"secondary"}>important</Badge>
            </AlertTitle>
            <AlertDescription>
              Generating embeddings can take a while, and in case you are using
              cloud hosted model will use tokens and potentially incur fees.
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
            type="submit"
          >
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
