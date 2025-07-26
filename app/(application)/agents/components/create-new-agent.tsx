import { useState } from "react";
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
import { Loading } from "@/components/ui/loading";
import { AgentBackendSelector } from "@/app/(application)/agents/components/agent-backend-selector";
import { AGENT_TYPES } from "@/util/enums/agent-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CreateNewAgent({ createAgent, createAgentResult, company }) {

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [backend, setBackend] = useState("");
  const [type, setType] = useState(AGENT_TYPES.CHAT);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Create new agent</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[475px]">
        <DialogHeader>
          <DialogTitle>Create a new agent</DialogTitle>
          <DialogDescription>
            Give your new agent a name and a description (optional).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              onChange={(e) => {
                setName(e.target.value);
              }}
              id="name"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              id="description"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Type</Label>
            <Select onValueChange={(value) => {
              setType(value)
            }} defaultValue={type}>
              <SelectTrigger>
                <SelectValue placeholder={type || `Select type`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem key={AGENT_TYPES.CHAT} value={AGENT_TYPES.CHAT}>
                  Chat
                </SelectItem>
                <SelectItem key={AGENT_TYPES.FLOW} value={AGENT_TYPES.FLOW}>
                  Flow
                </SelectItem>
                <SelectItem key={AGENT_TYPES.CUSTOM} value={AGENT_TYPES.CUSTOM}>
                  Custom
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="backend">Backend</Label>
            <AgentBackendSelector type={type} onSelect={(id) => {
              setBackend(id)
            }} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={createAgentResult.loading}
            onClick={() => {
              createAgent({
                variables: {
                  name,
                  description,
                  backend,
                  type: type.toLowerCase(),
                },
              });
            }}
            type="submit">
            Save {createAgentResult.loading && <Loading />}{" "}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
