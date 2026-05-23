"use client";

import { useMutation, useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  CREATE_MODEL,
  GET_MODEL_BY_ID,
  GET_MODELS,
  GET_PROVIDERS,
  GET_VARIABLES,
  UPDATE_MODEL,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loading } from "@/components/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { RBACControl } from "@/components/rbac";

type ModelFormProps = {
  modelId?: string;
};

export function ModelForm({ modelId }: ModelFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!modelId;

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [providerId, setProviderId] = React.useState("");
  const [authvariable, setAuthvariable] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [rbac, setRbac] = React.useState<{
    rights_mode: "private" | "users" | "roles" | "public";
    users: { id: number; rights: "read" | "write" }[];
    roles: { id: string; rights: "read" | "write" }[];
  }>({
    rights_mode: "private",
    users: [],
    roles: [],
  });
  const [requestsPerWindow, setRequestsPerWindow] = React.useState<string>("");
  const [windowSeconds, setWindowSeconds] = React.useState<string>("");
  const [tokenBudget, setTokenBudget] = React.useState<string>("");
  const [costBudgetUsd, setCostBudgetUsd] = React.useState<string>("");
  const [budgetWindow, setBudgetWindow] = React.useState<string>("");
  const [showLimits, setShowLimits] = React.useState(false);

  const { data: providersData, loading: providersLoading } = useQuery(GET_PROVIDERS);
  const { data: variablesData, loading: variablesLoading } = useQuery(GET_VARIABLES, {
    variables: { page: 1, limit: 100, filters: [{ encrypted: { eq: true } }] },
  });
  const { data: modelData, loading: modelLoading } = useQuery(GET_MODEL_BY_ID, {
    variables: { id: modelId },
    skip: !modelId,
  });

  React.useEffect(() => {
    if (!modelData?.modelById) return;
    const m = modelData.modelById;
    setName(m.name ?? "");
    setDescription(m.description ?? "");
    setProviderId(m.provider ?? "");
    setAuthvariable(m.authvariable ?? "");
    setActive(!!m.active);
    setRbac({
      rights_mode: (m.rights_mode ?? "private") as
        | "private"
        | "users"
        | "roles"
        | "public",
      users: m.RBAC?.users ?? [],
      roles: m.RBAC?.roles ?? [],
    });
    setRequestsPerWindow(m.requests_per_window?.toString() ?? "");
    setWindowSeconds(m.window_seconds?.toString() ?? "");
    setTokenBudget(m.token_budget?.toString() ?? "");
    setCostBudgetUsd(m.cost_budget_usd?.toString() ?? "");
    setBudgetWindow(m.budget_window ?? "");
  }, [modelData]);

  const [createModel, createState] = useMutation(CREATE_MODEL, {
    refetchQueries: [GET_MODELS, "GetModels"],
  });
  const [updateModel, updateState] = useMutation(UPDATE_MODEL, {
    refetchQueries: [GET_MODELS, "GetModels", GET_MODEL_BY_ID, "GetModelById"],
  });

  const submitting = createState.loading || updateState.loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !providerId) {
      toast({
        title: "Missing fields",
        description: "Name and provider are required.",
        variant: "destructive",
      });
      return;
    }

    const variables: any = {
      name,
      description: description || null,
      provider: providerId,
      authvariable: authvariable || null,
      active,
      rights_mode: rbac.rights_mode,
      RBAC: {
        users: rbac.users ?? [],
        roles: rbac.roles ?? [],
      },
      requests_per_window: requestsPerWindow ? Number(requestsPerWindow) : null,
      window_seconds: windowSeconds ? Number(windowSeconds) : null,
      token_budget: tokenBudget ? Number(tokenBudget) : null,
      cost_budget_usd: costBudgetUsd ? Number(costBudgetUsd) : null,
      budget_window: budgetWindow || null,
    };

    try {
      if (isEdit) {
        await updateModel({ variables: { id: modelId, ...variables } });
        toast({
          title: "Model updated",
          description: `"${name}" has been saved.`,
        });
      } else {
        await createModel({ variables });
        toast({
          title: "Model created",
          description: `"${name}" has been created.`,
        });
      }
      router.push("/models");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to save the model.",
        variant: "destructive",
      });
    }
  };

  const providers = providersData?.providers?.items ?? [];
  const variables = variablesData?.variablesPagination?.items ?? [];
  const selectedProvider = providers.find((p: any) => p.id === providerId);

  // Wait for the providers + variables lists before rendering the form. The
  // Select components map a `value` prop to a matching child <SelectItem>; if
  // we set `providerId` (or `authvariable`) before those items have mounted,
  // the trigger has nothing to display and the field renders as "Select…"
  // even though the value is set in state.
  if (modelLoading || providersLoading || variablesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loading />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Vertex Gemini 2.5 Flash — Production"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional internal note about this model configuration."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider">Provider *</Label>
        <Select value={providerId} onValueChange={setProviderId}>
          <SelectTrigger id="provider">
            <SelectValue
              placeholder={
                providersLoading ? "Loading providers..." : "Select a provider"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="font-mono text-xs mr-2">{p.provider}</span>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedProvider?.authenticationInformation && (
          <div className="mt-2 rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
            <div className="mb-1 font-medium">Authentication for this provider:</div>
            {selectedProvider.authenticationInformation}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="authvariable">Authentication variable</Label>
        <Select value={authvariable} onValueChange={setAuthvariable}>
          <SelectTrigger id="authvariable">
            <SelectValue
              placeholder={
                variablesLoading
                  ? "Loading variables..."
                  : "Select an encrypted variable"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {variables.length === 0 ? (
              <SelectItem value="__none" disabled>
                No encrypted variables found. Create one in Variables first.
              </SelectItem>
            ) : (
              variables.map((v: any) => (
                <SelectItem key={v.id} value={v.name}>
                  {v.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The encrypted variable that holds the credential for this provider.
          Must be marked as encrypted in the Variables page.
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch id="active" checked={active} onCheckedChange={setActive} />
        <Label htmlFor="active">Active</Label>
      </div>

      <div className="space-y-2">
        <Label>Access</Label>
        <RBACControl
          initialRightsMode={rbac.rights_mode}
          initialUsers={rbac.users}
          initialRoles={rbac.roles}
          onChange={(rights_mode, users, roles) => {
            setRbac({ rights_mode, users, roles });
          }}
        />
      </div>

      <div className="rounded-md border p-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowLimits((s) => !s)}
          className="text-sm font-medium text-left w-full"
        >
          {showLimits ? "▼" : "▶"} Rate limits & budget (advanced)
        </button>
        {showLimits && (
          <>
            <div className="rounded-md border bg-amber-50 dark:bg-amber-950 p-3 text-xs">
              These limits are stored but <strong>not enforced</strong> until
              LiteLLM is enabled in your environment. Setting them now lets you
              pre-configure values for the LiteLLM rollout.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requests_per_window">Requests per window</Label>
                <Input
                  id="requests_per_window"
                  type="number"
                  value={requestsPerWindow}
                  onChange={(e) => setRequestsPerWindow(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="window_seconds">Window seconds</Label>
                <Input
                  id="window_seconds"
                  type="number"
                  value={windowSeconds}
                  onChange={(e) => setWindowSeconds(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token_budget">Token budget</Label>
                <Input
                  id="token_budget"
                  type="number"
                  value={tokenBudget}
                  onChange={(e) => setTokenBudget(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost_budget_usd">Cost budget (USD)</Label>
                <Input
                  id="cost_budget_usd"
                  type="number"
                  step="0.01"
                  value={costBudgetUsd}
                  onChange={(e) => setCostBudgetUsd(e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="budget_window">Budget window</Label>
                <Select value={budgetWindow} onValueChange={setBudgetWindow}>
                  <SelectTrigger id="budget_window">
                    <SelectValue placeholder="Select window" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loading /> : isEdit ? "Save changes" : "Create model"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/models")}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
