"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Loader2, Plus, MessageSquare, Info, Sparkles, Settings2, FileText, AlertCircle } from "lucide-react";
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
import { CREATE_TEST_CASE, UPDATE_TEST_CASE, GET_TOOLS } from "@/queries/queries";
import { useToast } from "@/components/ui/use-toast";
import { TestCase } from "@/types/models/test-case";
import { Tool } from "@EXULU_SHARED/models/tool";
import { UIMessage, FileUIPart } from "ai";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UppyDashboard, { FileItem, getPresignedUrl } from "@/components/uppy-dashboard";
import { MessageRenderer } from "@/components/message-renderer";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";

interface TestCaseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testCase?: TestCase | null;
  evalSetId?: string;
}

export function TestCaseModal({
  open,
  onClose,
  evalSetId,
  onSuccess,
  testCase,
}: TestCaseModalProps) {
  const { toast } = useToast();
  const isEditing = !!testCase;

  // Fetch tools from server
  const { data: toolsData } = useQuery<{
    tools: {
      items: Tool[]
    }
  }>(GET_TOOLS, {
    variables: { page: 1, limit: 100 },
  });

  // Split tools by type
  const { regularTools, agentTools, knowledgeSourceTools } = useMemo(() => {
    const tools = toolsData?.tools?.items || [];
    console.log("tools", tools);
    return {
      regularTools: tools.filter(t => t.type === "function"),
      agentTools: tools.filter(t => t.type === "agent"),
      knowledgeSourceTools: tools.filter(t => t.type === "context"),
    };
  }, [toolsData]);

  // Basic fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");

  // Conversation inputs (UIMessage array)
  const [inputs, setInputs] = useState<UIMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentFiles, setCurrentFiles] = useState<string[] | null>(null);
  const [currentFileParts, setCurrentFileParts] = useState<FileUIPart[]>([]);

  // Optional expected fields
  const [expectedTools, setExpectedTools] = useState<string[]>([]);
  const [expectedKnowledgeSources, setExpectedKnowledgeSources] = useState<string[]>([]);
  const [expectedAgentTools, setExpectedAgentTools] = useState<string[]>([]);

  // Temp selectors
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [selectedContext, setSelectedContext] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");

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
      setSelectedTool("");
      setSelectedContext("");
      setSelectedAgent("");
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
      toast({
        title: "Test case created",
        description: "The test case has been successfully created.",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Failed to create test case",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [updateTestCase, { loading: updating }] = useMutation(UPDATE_TEST_CASE, {
    onCompleted: () => {
      toast({
        title: "Test case updated",
        description: "The test case has been successfully updated.",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Failed to update test case",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddMessage = () => {
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
      id: `msg-${Date.now()}`,
      role: "user",
      parts,
    };

    const placeholderMessage: UIMessage = {
      id: `msg-${Date.now()}`,
      role: "assistant",
      metadata: {
        type: "placeholder",
      },
      parts: [{
        type: "text",
        text: "💬 Placeholder, generated agent response will be added here when the test case is run...",
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

  const handleAddTool = () => {
    console.log("selectedTool", selectedTool);
    console.log("expectedTools", expectedTools);
    if (selectedTool && !expectedTools.includes(selectedTool)) {
      console.log("adding tool", selectedTool);
      console.log("new expectedTools", [...expectedTools, selectedTool]);
      setExpectedTools([...expectedTools, selectedTool]);
      setSelectedTool("");
    }
  };

  const handleAddContext = () => {
    console.log("selectedContext", selectedContext);
    console.log("expectedKnowledgeSources", expectedKnowledgeSources);
    if (selectedContext && !expectedKnowledgeSources.includes(selectedContext)) {
      console.log("adding context", selectedContext);
      console.log("new expectedKnowledgeSources", [...expectedKnowledgeSources, selectedContext]);
      setExpectedKnowledgeSources([...expectedKnowledgeSources, selectedContext]);
      setSelectedContext("");
    }
  };

  const handleAddAgent = () => {
    console.log("selectedAgent", selectedAgent);
    console.log("expectedAgentTools", expectedAgentTools);
    if (selectedAgent && !expectedAgentTools.includes(selectedAgent)) {
      console.log("adding agent", selectedAgent);
      console.log("new expectedAgentTools", [...expectedAgentTools, selectedAgent]);
      setExpectedAgentTools([...expectedAgentTools, selectedAgent]);
      setSelectedAgent("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !expectedOutput.trim() || inputs.length === 0) {
      toast({
        title: "Validation error",
        description: "Name, at least one input message, and expected output are required.",
        variant: "destructive",
      });
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

  const getToolName = (id: string) => {
    const tool = regularTools.find(t => t.id === id);
    return tool?.name || id;
  };

  const getContextName = (id: string) => {
    const context = knowledgeSourceTools.find(t => t.id === id);
    return context?.name || id;
  };

  const getAgentName = (id: string) => {
    const agent = agentTools.find(t => t.id === id);
    return agent?.name || id;
  };

  const getFileCount = (message: UIMessage) => {
    return message.parts.filter(part => part.type === "file").length;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Test Case" : "Create Test Case"} {evalSetId ? `for Eval Set: ${evalSetId}` : ""}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the test case details." : "Create a new test case with conversation inputs and expected outputs."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic" className="gap-2">
                <Info className="h-4 w-4" />
                Basic Info
              </TabsTrigger>
              <TabsTrigger value="conversation" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Conversation
              </TabsTrigger>
              {/* <TabsTrigger value="expected" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Expected Tools
              </TabsTrigger> */}
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="basic" className="space-y-4 p-1 mt-4">
                <div className="grid gap-5">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Customer Support - Refund Request"
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
                      placeholder="Describe what this test case evaluates..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={loading}
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="expectedOutput">Expected Output *</Label>
                    <Textarea
                      id="expectedOutput"
                      placeholder="Describe the expected final output (e.g., 'A JSON object containing refund details', 'An empathetic response offering alternatives')"
                      value={expectedOutput}
                      onChange={(e) => setExpectedOutput(e.target.value)}
                      disabled={loading}
                      rows={4}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      This can be an exact expected response or a description of what the output should contain.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="conversation" className="space-y-4 p-1 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Conversation Flow
                          {inputs.length > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {inputs.length} {inputs.length === 1 ? 'message' : 'messages'}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1.5">
                          Add user messages in order. The agent will run through this conversation flow and respond between each message automatically.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">

                    {inputs?.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-muted rounded-lg">
                        <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="font-semibold text-lg mb-2">No messages yet</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          Start building your test conversation by adding user messages below.
                        </p>
                      </div>
                    ) : (
                      /* @ts-ignore */
                      <Conversation className="max-h-[350px] overflow-y-auto border rounded-lg bg-muted/30 transition-all duration-300 ease-in-out">
                        {/* @ts-ignore */}
                        <ConversationContent className="px-6 py-4">
                          <div className="animate-in fade-in duration-500">
                            <MessageRenderer
                              messages={inputs}
                              config={{
                                marginTopFirstMessage: 'mt-0',
                                customAssistantClassnames: 'bg-secondary/50 rounded-lg px-3 py-1 border-l-2 border-primary/30'
                              }}
                              status={"ready"}
                              showActions={false}
                              writeAccess={false}
                            />
                          </div>
                        </ConversationContent>
                      </Conversation>
                    )}

                    <div className="space-y-3 pt-2 border-t">
                      <Label htmlFor="currentInput" className="text-sm font-semibold">Add User Message</Label>
                      <div className="space-y-3">
                        <Textarea
                          id="currentInput"
                          placeholder="Type the user's message..."
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
                            onClick={handleAddMessage}
                            disabled={loading || (!currentInput.trim() && currentFileParts.length === 0)}
                            className="ml-auto"
                            size="default"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Message
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
                                <strong>Note:</strong> When running this test case, ensure the selected agent supports the file types you've attached here (images, documents, audio, etc.).
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Press Enter to add, Shift+Enter for new line. You can attach files to messages.
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
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !expectedOutput.trim() || inputs.length === 0}
              className="shadow-sm hover:shadow-md transition-all"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Test Case" : "Create Test Case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog >
  );
}
