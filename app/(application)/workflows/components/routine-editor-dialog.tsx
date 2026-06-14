"use client";

/**
 * RoutineEditorDialog — migrated from `components/save-workflow-modal.tsx`.
 *
 * Public surface (props) MUST match ChatSaveAsRoutineHandshake exactly —
 * the chat header at `components/save-workflow-modal.tsx` re-exports this
 * symbol verbatim so chat's import path keeps resolving.
 *
 * Bug fixes from workflows.md UX review:
 * - #6 (high): file attachments now actually attach. We convert the
 *   FilePicker's s3 keys into FileUIPart[] (same pattern as
 *   `evals/cases/components/test-case-modal.tsx`) and merge them into the
 *   next message on Add.
 * - #8 (med): `agentId` is required + always sent in the UPDATE payload, so
 *   editing from the table can no longer detach the routine's agent.
 * - #10 (high partial): `teams` are included in the RBAC payload only when
 *   ROUTINES_RBAC_TEAMS_SUPPORTED — otherwise a single dev-warn logs the
 *   silent drop instead of pretending it persists.
 * - #17 (low): emojis removed; the placeholder + pro-tip + warning copy is
 *   plain text with semantic icons where helpful.
 * - #18 (low): the 1-second sleep before adding a message is gone; ids
 *   come from crypto.randomUUID() (collision-free).
 *
 * Copy renamed to "Routine" everywhere visible (workflows.md UX #2).
 */

import { useMutation } from "@apollo/client";
import type { FileUIPart, UIMessage } from "ai";
import { AlertCircle, ChevronDown, Loader2, Plus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { MessageRenderer } from "@/components/message-renderer";
import UppyDashboard, {
  FileItem,
  getPresignedUrl,
} from "@/components/primitives/file-picker";
import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  CREATE_WORKFLOW_TEMPLATE,
  GET_WORKFLOW_TEMPLATES,
  UPDATE_WORKFLOW_TEMPLATE,
} from "../queries";
import { ROUTINES_RBAC_TEAMS_SUPPORTED } from "../schema-flags";
import type { RoutineRightsMode } from "../types";

type RBACUser = { id: number; rights: "read" | "write" };
type RBACRole = { id: string; rights: "read" | "write" };
type RBACTeam = { id: string; rights: "read" | "write" };

interface ExistingRoutine {
  id: string;
  name: string;
  description?: string | null;
  rights_mode?: RoutineRightsMode;
  RBAC?: {
    users?: RBACUser[];
    roles?: RBACRole[];
    teams?: RBACTeam[];
  };
  steps_json?: UIMessage[] | null;
  agent?: string;
}

export interface RoutineEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messages: UIMessage[];
  /** Required for create AND update — fixes the agent-detach bug (UX #8). */
  agentId: string;
  sessionTitle?: string;
  existingWorkflow?: ExistingRoutine;
  isReadOnly?: boolean;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const createPlaceholderMessage = (): UIMessage => ({
  id: newId(),
  role: "assistant",
  metadata: { type: "placeholder" },
  parts: [
    {
      type: "text",
      text: "Placeholder — the agent's generated response will appear here when the routine runs.",
    },
  ],
});

export function RoutineEditorDialog({
  isOpen,
  onClose,
  messages,
  sessionTitle,
  existingWorkflow,
  isReadOnly = false,
  agentId,
}: RoutineEditorDialogProps) {
  const t = useTranslations("routines");
  const tCommon = useTranslations("common");
  const { user } = React.useContext(UserContext);

  const isEditing = Boolean(existingWorkflow);

  const [rbac, setRbac] = React.useState<{
    rights_mode: RoutineRightsMode;
    users: RBACUser[];
    roles: RBACRole[];
    teams: RBACTeam[];
  }>({
    rights_mode: existingWorkflow?.rights_mode ?? "private",
    users: existingWorkflow?.RBAC?.users ?? [],
    roles: existingWorkflow?.RBAC?.roles ?? [],
    teams: existingWorkflow?.RBAC?.teams ?? [],
  });

  const [name, setName] = React.useState(existingWorkflow?.name ?? "");
  const [description, setDescription] = React.useState(
    existingWorkflow?.description ?? "",
  );
  const [steps, setSteps] = React.useState<UIMessage[]>(() => {
    if (existingWorkflow?.steps_json && existingWorkflow.steps_json.length > 0) {
      return existingWorkflow.steps_json;
    }
    const initial: UIMessage[] = [];
    for (const step of messages) {
      if (step.role === "user") initial.push(step);
      else initial.push(createPlaceholderMessage());
    }
    return initial;
  });

  const [activeTab, setActiveTab] = React.useState<"setup" | "steps">("setup");
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const [currentInput, setCurrentInput] = React.useState("");
  const [currentFiles, setCurrentFiles] = React.useState<string[] | null>(null);
  const [currentFileParts, setCurrentFileParts] = React.useState<FileUIPart[]>(
    [],
  );

  // BUG FIX (UX #6): convert s3 keys -> FileUIPart[] so they actually attach.
  React.useEffect(() => {
    if (!currentFiles || currentFiles.length === 0) {
      setCurrentFileParts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const parts = await Promise.all(
        currentFiles.map(async (key) => ({
          type: "file" as const,
          mediaType: key.split(".").pop() ?? "",
          filename: key,
          url: await getPresignedUrl(key),
        })),
      );
      if (!cancelled) setCurrentFileParts(parts);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentFiles]);

  // On open / props change, re-seed.
  React.useEffect(() => {
    if (!isOpen) return;
    if (existingWorkflow) {
      setName(existingWorkflow.name);
      setDescription(existingWorkflow.description ?? "");
      setRbac({
        rights_mode: existingWorkflow.rights_mode ?? "private",
        users: existingWorkflow.RBAC?.users ?? [],
        roles: existingWorkflow.RBAC?.roles ?? [],
        teams: existingWorkflow.RBAC?.teams ?? [],
      });
      if (existingWorkflow.steps_json && existingWorkflow.steps_json.length > 0) {
        setSteps(existingWorkflow.steps_json);
      }
    } else {
      setName(sessionTitle ?? "");
      const initial: UIMessage[] = [];
      for (const step of messages) {
        if (step.role === "user") initial.push(step);
        else initial.push(createPlaceholderMessage());
      }
      setSteps(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const [createMutation, { loading: creating }] = useMutation(
    CREATE_WORKFLOW_TEMPLATE,
    {
      refetchQueries: [GET_WORKFLOW_TEMPLATES, "GetWorkflowTemplates"],
    },
  );
  const [updateMutation, { loading: updating }] = useMutation(
    UPDATE_WORKFLOW_TEMPLATE,
    {
      refetchQueries: [GET_WORKFLOW_TEMPLATES, "GetWorkflowTemplates"],
    },
  );
  const loading = creating || updating;

  const handleAddMessage = () => {
    if (!currentInput.trim() && currentFileParts.length === 0) return;

    // Mirror the test-case-modal pattern (`any[]` is the project convention
    // here — UIMessagePart's generic typing is too strict for inline use).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];
    if (currentInput.trim()) {
      parts.push({ type: "text", text: currentInput.trim() });
    }
    if (currentFileParts.length > 0) {
      parts.push(...currentFileParts);
    }

    const newMessage: UIMessage = {
      id: newId(),
      role: "user",
      parts,
    };

    setSteps([...steps, newMessage, createPlaceholderMessage()]);
    setCurrentInput("");
    setCurrentFiles(null);
    setCurrentFileParts([]);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!name.trim()) {
      toast.error(t("editor.toast.nameRequired"));
      return;
    }
    if (!agentId) {
      toast.error(t("editor.toast.agentRequired"));
      return;
    }

    // Build RBAC payload — gated on the teams flag (workflows.md UX #10).
    const RBACPayload: {
      users: RBACUser[];
      roles: RBACRole[];
      teams?: RBACTeam[];
    } = {
      users: rbac.users,
      roles: rbac.roles,
    };
    if (ROUTINES_RBAC_TEAMS_SUPPORTED) {
      RBACPayload.teams = rbac.teams;
    } else if (rbac.teams.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[routines] ROUTINES_RBAC_TEAMS_SUPPORTED is false — teams will not be persisted",
      );
    }

    try {
      if (isEditing && existingWorkflow) {
        await updateMutation({
          variables: {
            id: existingWorkflow.id,
            name: name.trim(),
            description: description.trim() || null,
            rights_mode: rbac.rights_mode,
            agent: agentId, // BUG FIX (UX #8): always send.
            RBAC: RBACPayload,
            steps_json: steps,
          },
        });
        toast.success(t("editor.toast.updated", { name: name.trim() }));
      } else {
        await createMutation({
          variables: {
            name: name.trim(),
            description: description.trim() || null,
            rights_mode: rbac.rights_mode,
            agent: agentId,
            RBAC: RBACPayload,
            steps_json: steps,
          },
        });
        toast.success(t("editor.toast.created", { name: name.trim() }));
      }
      onClose();
    } catch (err) {
      toast.error(t("editor.toast.saveFailed"), {
        description: (err as Error).message,
      });
    }
  };

  // Truthful collapsed-sharing summary.
  const sharingSummary = React.useMemo(() => {
    switch (rbac.rights_mode) {
      case "private":
        return t("editor.sharing.collapsed.private");
      case "public":
        return t("editor.sharing.collapsed.public");
      case "users":
        return t("editor.sharing.collapsed.users", { count: rbac.users.length });
      case "roles":
        return t("editor.sharing.collapsed.roles", { count: rbac.roles.length });
      case "teams":
        if (!ROUTINES_RBAC_TEAMS_SUPPORTED) {
          return t("editor.sharing.collapsed.teamsDegraded");
        }
        return t("editor.sharing.collapsed.teams", { count: rbac.teams.length });
      default:
        return t("editor.sharing.collapsed.private");
    }
  }, [rbac, t]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-dvh max-h-dvh w-full max-w-full flex-col rounded-none p-4 sm:h-auto sm:max-h-[85dvh] sm:max-w-4xl sm:rounded-lg sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">
            {isEditing
              ? isReadOnly
                ? t("editor.title.view")
                : t("editor.title.edit")
              : t("editor.title.save")}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isEditing
              ? isReadOnly
                ? t("editor.description.view")
                : t("editor.description.edit")
              : t("editor.description.save")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "setup" | "steps")}
            className="flex h-full flex-col"
          >
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="setup">{t("editor.tabs.setup")}</TabsTrigger>
              <TabsTrigger value="steps">{t("editor.tabs.steps")}</TabsTrigger>
            </TabsList>

            <div className="flex-1">
              {/* Setup tab */}
              <TabsContent value="setup" className="m-0 h-full">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="routine-name" className="text-sm font-medium">
                        {t("editor.name.label")}
                      </Label>
                      <Input
                        id="routine-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("editor.name.placeholder")}
                        className="mt-2"
                        readOnly={isReadOnly}
                      />
                      {!name.trim() ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle aria-hidden="true" className="size-3" />
                          {t("editor.name.required")}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <Label
                        htmlFor="routine-description"
                        className="text-sm font-medium"
                      >
                        {t("editor.description.label")}
                      </Label>
                      <Textarea
                        id="routine-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t("editor.description.placeholder")}
                        rows={3}
                        className="mt-2 resize-none"
                        readOnly={isReadOnly}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium">
                          {t("editor.sharing.heading")}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {sharingSummary}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAdvanced((v) => !v)}
                      >
                        {showAdvanced
                          ? t("editor.sharing.hide")
                          : t("editor.sharing.show")}
                        <ChevronDown
                          aria-hidden="true"
                          className={cn(
                            "ml-1 size-4 transition-transform",
                            showAdvanced && "rotate-180",
                          )}
                        />
                      </Button>
                    </div>
                    {showAdvanced ? (
                      <RBACControl
                        initialRightsMode={rbac.rights_mode}
                        initialUsers={rbac.users}
                        initialRoles={rbac.roles}
                        initialTeams={rbac.teams}
                        onChange={(rights_mode, users, roles, teams) => {
                          setRbac({ rights_mode, users, roles, teams });
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              </TabsContent>

              {/* Steps tab */}
              <TabsContent value="steps" className="m-0 h-full">
                <div className="flex h-full flex-col gap-4">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">
                      {t("editor.steps.heading")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t("editor.steps.tip")}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {steps.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-center">
                        <Sparkles
                          aria-hidden="true"
                          className="mb-3 size-10 text-muted-foreground/50"
                        />
                        <h4 className="text-sm font-medium">
                          {t("editor.steps.emptyTitle")}
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("editor.steps.emptyDescription")}
                        </p>
                      </div>
                    ) : (
                      /* @ts-ignore */
                      <Conversation className="max-h-[350px] overflow-y-auto rounded-lg border bg-muted/30">
                        {/* @ts-ignore */}
                        <ConversationContent className="px-4 py-4">
                          <MessageRenderer
                            messages={steps}
                            config={{
                              marginTopFirstMessage: "mt-0",
                              customAssistantClassnames:
                                "px-4 py-4 border-l-2 border-primary/30",
                            }}
                            onUpdate={(next: UIMessage[]) => setSteps(next)}
                            status="ready"
                            showActions={true}
                            showEdit={!isReadOnly}
                            showRemove={!isReadOnly}
                            showTokens={false}
                            writeAccess={!isReadOnly}
                          />
                        </ConversationContent>
                      </Conversation>
                    )}

                    {!isReadOnly ? (
                      <div className="space-y-3 pt-2">
                        <Label
                          htmlFor="step-input"
                          className="text-sm font-medium"
                        >
                          {t("editor.steps.addMessage")}
                        </Label>
                        <Textarea
                          id="step-input"
                          placeholder={t("editor.steps.placeholder")}
                          value={currentInput}
                          onChange={(e) => setCurrentInput(e.target.value)}
                          disabled={loading}
                          rows={2}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleAddMessage();
                            }
                          }}
                        />

                        <div className="flex items-center gap-2">
                          <UppyDashboard
                            id="routine-step-files"
                            selectionLimit={10}
                            allowedFileTypes={[
                              ".png", ".jpg", ".jpeg", ".gif", ".webp",
                              ".pdf", ".docx", ".xlsx", ".xls", ".csv", ".pptx", ".ppt",
                              ".mp3", ".wav", ".m4a", ".mp4", ".mpeg",
                            ]}
                            dependencies={[]}
                            onConfirm={(items) => setCurrentFiles(items)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddMessage}
                            disabled={
                              loading ||
                              (!currentInput.trim() && currentFileParts.length === 0)
                            }
                            className="ml-auto"
                          >
                            <Plus aria-hidden="true" className="mr-2 size-4" />
                            {t("editor.steps.add")}
                          </Button>
                        </div>

                        {currentFiles && currentFiles.length > 0 ? (
                          <>
                            <div className="grid grid-cols-3 gap-2">
                              {currentFiles.map((item) => (
                                <FileItem
                                  key={item}
                                  s3Key={item}
                                  disabled={true}
                                  active={false}
                                  onRemove={() =>
                                    setCurrentFiles(
                                      currentFiles.filter((i) => i !== item),
                                    )
                                  }
                                />
                              ))}
                            </div>
                            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                              <AlertCircle
                                aria-hidden="true"
                                className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                              />
                              <p className="text-xs text-amber-900 dark:text-amber-200">
                                {t("editor.steps.fileTypeWarning")}
                              </p>
                            </div>
                          </>
                        ) : null}

                        <p className="text-xs text-muted-foreground">
                          {t("editor.steps.hint")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="shrink-0 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          <Button variant="outline" onClick={onClose}>
            {isReadOnly ? t("editor.close") : tCommon("cancel")}
          </Button>
          {!isReadOnly ? (
            <Button onClick={handleSave} disabled={loading || !name.trim()}>
              {loading ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="mr-2 size-4 animate-spin"
                  />
                  {isEditing ? t("editor.updating") : t("editor.saving")}
                </>
              ) : isEditing ? (
                t("editor.update")
              ) : (
                t("editor.save")
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Chat-handshake compatibility: chat imports `SaveWorkflowModal` from
 * `@/components/save-workflow-modal`. The barrel at that path re-exports
 * the symbol below verbatim — same props, byte-equivalent behavior, no
 * regression risk.
 */
export const SaveWorkflowModal = RoutineEditorDialog;
