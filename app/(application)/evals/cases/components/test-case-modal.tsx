"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@apollo/client";
import { Loader2, Plus, MessageSquare, Info, Sparkles, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { Textarea } from "@/components/ui/textarea";
import { CREATE_TEST_CASE, UPDATE_TEST_CASE } from "@/queries/queries";
import { toast } from "sonner";
import { TestCase } from "@/types/models/test-case";
import { UIMessage, FileUIPart } from "ai";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import UppyDashboard, { FileItem, getPresignedUrl } from "@/components/primitives/file-picker";
import { MessageRenderer } from "@/components/message-renderer";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";

interface TestCaseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testCase?: TestCase | null;
  evalSetId?: string;
  /** Human-readable eval-set name shown in the dialog title (replaces the
   * old behavior of leaking the eval-set UUID into the title). */
  evalSetName?: string;
}

export function TestCaseModal({
  open,
  onClose,
  evalSetId,
  evalSetName,
  onSuccess,
  testCase,
}: TestCaseModalProps) {
  const tc = useTranslations("evals.cases.modal");
  const tCommon = useTranslations("evals.common");
  const isEditing = !!testCase;

  // Basic fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");

  // Conversation inputs (UIMessage array)
  const [inputs, setInputs] = useState<UIMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentFiles, setCurrentFiles] = useState<string[] | null>(null);
  const [currentFileParts, setCurrentFileParts] = useState<FileUIPart[]>([]);

  // Optional expected fields — state arrays + serialization passthrough are
  // retained so existing test-case records round-trip through edit/save
  // without losing data, even though the UI to author them is intentionally
  // deferred this phase (see comment near handleSubmit / TabsContent).
  const [expectedTools, setExpectedTools] = useState<string[]>([]);
  const [expectedKnowledgeSources, setExpectedKnowledgeSources] = useState<string[]>([]);
  const [expectedAgentTools, setExpectedAgentTools] = useState<string[]>([]);

  useEffect(() => {
    if (testCase && open) {
      setName(testCase.name);
      setDescription(testCase.description || "");
      setExpectedOutput(testCase.expected_output);
      setInputs(testCase.inputs || []);
      setExpectedTools(testCase.expected_tools || []);
      setExpectedKnowledgeSources(testCase.expected_knowledge_sources || []);
      setExpectedAgentTools(testCase.expected_agent_tools || []);
    } else if (!open) {
      // Reset when closing
      setName("");
      setDescription("");
      setExpectedOutput("");
      setInputs([]);
      setCurrentInput("");
      setCurrentFiles(null);
      setCurrentFileParts([]);
      setExpectedTools([]);
      setExpectedKnowledgeSources([]);
      setExpectedAgentTools([]);
    }
  }, [testCase, open]);

  // Convert items to FileUIPart when files are selected
  const updateMessageFiles = async (keys: string[]) => {
    const files = await Promise.all(keys.map(async (key) => {
      /* if (!item.s3key) {
        // Take all item fields and turn into a data url
        let content = "";
        Object.entries(item).forEach(([key, value]) => {
          content += `${key}: ${value}\n`
        })
        return {
          type: "file" as const,
          mediaType: item.type,
          filename: item.name,
          url: `data:text/plain;base64,${btoa(content)}`
        }
      } */

      return {
        type: "file" as const,
        mediaType: key.split(".").pop() || "",
        filename: key,
        url: await getPresignedUrl(key)
      }
    }))
    setCurrentFileParts(files)
  }

  useEffect(() => {
    if (!currentFiles || currentFiles.length === 0) {
      setCurrentFileParts([])
      return;
    }
    updateMessageFiles(currentFiles)
  }, [currentFiles])

  const [createTestCase, { loading: creating }] = useMutation(CREATE_TEST_CASE, {
    onCompleted: () => {
      toast.success(tc("create.successTitle"));
      onSuccess();
    },
    onError: (error) => {
      toast.error(tc("create.errorTitle"), { description: error.message });
    },
  });

  const [updateTestCase, { loading: updating }] = useMutation(UPDATE_TEST_CASE, {
    onCompleted: () => {
      toast.success(tc("edit.successTitle"));
      onSuccess();
    },
    onError: (error) => {
      toast.error(tc("edit.errorTitle"), { description: error.message });
    },
  });

  const handleAddMessage = async () => {
    if (!currentInput.trim() && currentFileParts.length === 0) return;

    const parts: any[] = [];

    if (currentInput.trim()) {
      parts.push({
        type: "text",
        text: currentInput.trim(),
      });
    }

    // Add file parts
    if (currentFileParts.length > 0) {
      parts.push(...currentFileParts);
    }

    const newMessage: UIMessage = {
      // crypto.randomUUID() guarantees uniqueness without needing the old
      // 1-second sleep that paired with `Date.now()` ids — the sleep was a
      // workaround for collisions that should never exist with real uuids.
      id: `msg-${crypto.randomUUID()}`,
      role: "user",
      parts,
    };

    const placeholderMessage: UIMessage = {
      id: `msg-${crypto.randomUUID()}`,
      role: "assistant",
      metadata: {
        type: "placeholder",
      },
      parts: [{
        type: "text",
        text: tc("placeholderMessage"),
      }],
    };

    setInputs([...inputs, newMessage, placeholderMessage]);
    setCurrentInput("");
    setCurrentFiles(null);
    setCurrentFileParts([]);
  };

  const handleRemoveMessage = (index: number) => {
    setInputs(inputs.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !expectedOutput.trim() || inputs.length === 0) {
      toast.error(tc("validationError"));
      return;
    }

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      inputs,
      expected_output: expectedOutput.trim(),
      expected_tools: expectedTools.length > 0 ? expectedTools : null,
      expected_knowledge_sources: expectedKnowledgeSources.length > 0 ? expectedKnowledgeSources : null,
      expected_agent_tools: expectedAgentTools.length > 0 ? expectedAgentTools : null,
      ...(evalSetId ? { eval_set_id: evalSetId } : {}),
    };

    if (isEditing) {
      updateTestCase({
        variables: {
          id: testCase.id,
          data,
        },
      });
    } else {
      createTestCase({
        variables: {
          data,
        },
      });
    }
  };

  const loading = creating || updating;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* `<md` (≤768px) becomes a full-bleed sheet — the original max-w-4xl
          centered dialog clipped the conversation tab on small viewports.
          We override the base DialogContent fixed-center positioning (which
          assumes a centered card) at the mobile breakpoint and reset it at
          `md+`. */}
      <DialogContent
        className={
          // mobile full-screen
          "inset-0 left-0 top-0 max-h-[100dvh] w-screen max-w-full translate-x-0 translate-y-0 overflow-hidden rounded-none p-4 sm:rounded-none flex flex-col" +
          // md+ centered modal
          " md:inset-auto md:left-[50%] md:top-[50%] md:h-auto md:max-h-[90dvh] md:w-full md:max-w-4xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:p-6"
        }
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? evalSetName
                ? tc("editTitleForSet", { setName: evalSetName })
                : tc("editTitle")
              : evalSetName
                ? tc("createTitleForSet", { setName: evalSetName })
                : tc("createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? tc("editDescription") : tc("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic" className="gap-2">
                <Info className="h-4 w-4" />
                {tc("tabs.basic")}
              </TabsTrigger>
              <TabsTrigger value="conversation" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                {tc("tabs.conversation")}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="basic" className="space-y-4 p-1 mt-4">
                <div className="grid gap-5">
                  <div className="grid gap-2">
                    <Label htmlFor="name">{tc("nameLabel")}</Label>
                    <Input
                      id="name"
                      placeholder={tc("namePlaceholder")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">{tc("descriptionLabel")}</Label>
                    <Textarea
                      id="description"
                      placeholder={tc("descriptionPlaceholder")}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={loading}
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="expectedOutput">{tc("expectedOutputLabel")}</Label>
                    <Textarea
                      id="expectedOutput"
                      placeholder={tc("expectedOutputPlaceholder")}
                      value={expectedOutput}
                      onChange={(e) => setExpectedOutput(e.target.value)}
                      disabled={loading}
                      rows={4}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {tc("expectedOutputHelp")}
                    </p>
                  </div>

                  {/* Advanced expectations (expected tools / knowledge / agents)
                     are intentionally not surfaced in Phase 5.1 — design notes
                     flag the affordance as needing product confirmation
                     (see design/pages/evals.md). State + serialization for the
                     three `expected_*` fields remain wired (see handleSubmit)
                     so existing test-case records round-trip without loss.
                     Track as future work. */}
                </div>
              </TabsContent>

              <TabsContent value="conversation" className="space-y-4 p-1 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          {tc("conversation.title")}
                          {inputs.length > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {inputs.length}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1.5">
                          {tc("conversation.description")}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">

                    {inputs?.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-muted rounded-lg">
                        <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="font-semibold text-lg mb-2">
                          {tc("conversation.emptyTitle")}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          {tc("conversation.emptyDescription")}
                        </p>
                      </div>
                    ) : (
                      /* @ts-ignore */
                      <Conversation className="max-h-[350px] overflow-y-auto border rounded-lg bg-muted/30 transition-all duration-300 ease-in-out">
                        {/* @ts-ignore */}
                        <ConversationContent className="px-6 py-4">
                          <div className="animate-in fade-in duration-500 space-y-4">
                            <MessageRenderer
                              messages={inputs || []}
                              config={{
                                marginTopFirstMessage: 'mt-0',
                                customAssistantClassnames: 'bg-secondary/50 rounded-lg px-4 py-4 border-l-2 border-primary/30'
                              }}
                              onUpdate={(messages) => {
                                setInputs(messages);
                              }}
                              status={"ready"}
                              showActions={true}
                              showEdit={true}
                              showRemove={true}
                              showTokens={false}
                              writeAccess={true}
                            />
                          </div>
                        </ConversationContent>
                      </Conversation>
                    )}

                    <div className="space-y-3 pt-2">
                      <Label htmlFor="currentInput" className="text-sm font-semibold">
                        {tc("conversation.addLabel")}
                      </Label>
                      <div className="space-y-3">
                        <Textarea
                          id="currentInput"
                          placeholder={tc("conversation.addPlaceholder")}
                          value={currentInput}
                          onChange={(e) => setCurrentInput(e.target.value)}
                          disabled={loading}
                          rows={2}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              await handleAddMessage();
                            }
                          }}
                        />

                        <div className="flex items-center gap-2">
                          <UppyDashboard
                            id="test-case-files"
                            selectionLimit={10}
                            allowedFileTypes={[
                              '.png', '.jpg', '.jpeg', '.gif', '.webp',
                              '.pdf', '.docx', '.xlsx', '.xls', '.csv', '.pptx', '.ppt',
                              '.mp3', '.wav', '.m4a', '.mp4', '.mpeg'
                            ]}
                            dependencies={[]}
                            onConfirm={(items) => {
                              setCurrentFiles(items)
                            }}
                          />

                          <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                              await handleAddMessage();
                            }}
                            disabled={loading || (!currentInput.trim() && currentFileParts.length === 0)}
                            className="ml-auto"
                            size="default"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {tc("conversation.addButton")}
                          </Button>
                        </div>

                        {currentFiles && currentFiles.length > 0 && (
                          <>
                            <div className="grid grid-cols-3 gap-2">
                              {currentFiles.map((item) => (
                                <FileItem
                                  s3Key={item}
                                  disabled={true}
                                  active={false}
                                  onRemove={() => {
                                    setCurrentFiles(currentFiles?.filter((i) => i !== item))
                                  }}
                                />
                              ))}
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-amber-900 dark:text-amber-200">
                                {tc("conversation.fileWarning")}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {tc("conversation.helper")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* <TabsContent value="expected" className="space-y-4 p-1 mt-4">
                <div className="grid gap-5">
                  <Card className="border-l-2 border-l-blue-500/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Expected Tools (Optional)
                        {expectedTools.length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {expectedTools.length}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>Regular tools that should be used during the conversation</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        {expectedTools.map((toolId, index) => (
                          <Badge key={index} variant="secondary">
                            {getToolName(toolId)}
                            <button
                              type="button"
                              onClick={() => setExpectedTools(expectedTools.filter((_, i) => i !== index))}
                              className="ml-2 hover:text-destructive">
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Select value={selectedTool} onValueChange={setSelectedTool} disabled={loading}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select a tool to add..." />
                          </SelectTrigger>
                          <SelectContent>
                            {regularTools.map((tool) => (
                              <SelectItem key={tool.id} value={tool.id}>
                                {tool.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          onClick={handleAddTool}
                          disabled={loading || !selectedTool}
                          className="gap-1.5"
                          variant={selectedTool ? "default" : "outline"}
                        >
                          <Plus className="h-4 w-4" />
                          <span className="hidden sm:inline">Add</span>
                        </Button>
                      </div>
                      {!selectedTool && (
                        <p className="text-xs text-muted-foreground/75 italic">
                          Select a tool from the dropdown, then click Add
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-l-2 border-l-purple-500/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Expected Knowledge Sources (Optional)
                        {expectedKnowledgeSources.length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {expectedKnowledgeSources.length}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>Context/knowledge sources that should be used</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        {expectedKnowledgeSources.map((contextId, index) => (
                          <Badge key={index} variant="secondary">
                            {getContextName(contextId)}
                            <button
                              type="button"
                              onClick={() => setExpectedKnowledgeSources(expectedKnowledgeSources.filter((_, i) => i !== index))}
                              className="ml-2 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Select value={selectedContext} onValueChange={setSelectedContext} disabled={loading}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select a knowledge source to add..." />
                          </SelectTrigger>
                          <SelectContent>
                            {knowledgeSourceTools.map((context) => (
                              <SelectItem key={context.id} value={context.id}>
                                {context.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          onClick={handleAddContext}
                          disabled={loading || !selectedContext}
                          className="gap-1.5"
                          variant={selectedContext ? "default" : "outline"}
                        >
                          <Plus className="h-4 w-4" />
                          <span className="hidden sm:inline">Add</span>
                        </Button>
                      </div>
                      {!selectedContext && (
                        <p className="text-xs text-muted-foreground/75 italic">
                          Select a knowledge source from the dropdown, then click Add
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-l-2 border-l-green-500/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Expected Agent Tools (Optional)
                        {expectedAgentTools.length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {expectedAgentTools.length}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>Agents that should be called as tools</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        {expectedAgentTools.map((agentId, index) => (
                          <Badge key={index} variant="secondary">
                            {getAgentName(agentId)}
                            <button
                              type="button"
                              onClick={() => setExpectedAgentTools(expectedAgentTools.filter((_, i) => i !== index))}
                              className="ml-2 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Select value={selectedAgent} onValueChange={setSelectedAgent} disabled={loading}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select an agent to add..." />
                          </SelectTrigger>
                          <SelectContent>
                            {agentTools.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          onClick={handleAddAgent}
                          disabled={loading || !selectedAgent}
                          className="gap-1.5"
                          variant={selectedAgent ? "default" : "outline"}
                        >
                          <Plus className="h-4 w-4" />
                          <span className="hidden sm:inline">Add</span>
                        </Button>
                      </div>
                      {!selectedAgent && (
                        <p className="text-xs text-muted-foreground/75 italic">
                          Select an agent from the dropdown, then click Add
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent> */}
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !expectedOutput.trim() || inputs.length === 0}
              className="shadow-sm hover:shadow-md transition-all"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? tc("edit.submit") : tc("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog >
  );
}
