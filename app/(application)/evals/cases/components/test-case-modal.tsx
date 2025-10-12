"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Loader2, Plus, Trash2, MessageSquare, Paperclip } from "lucide-react";
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
import { Item } from "@/types/models/item";
import { MessageRenderer } from "@/components/message-renderer";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";

interface TestCaseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testCase?: TestCase | null;
}

export function TestCaseModal({
  open,
  onClose,
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
      parts: [{
        type: "text",
        text: "Agent response placeholder",
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
    if (selectedTool && !expectedTools.includes(selectedTool)) {
      setExpectedTools([...expectedTools, selectedTool]);
      setSelectedTool("");
    }
  };

  const handleAddContext = () => {
    if (selectedContext && !expectedKnowledgeSources.includes(selectedContext)) {
      setExpectedKnowledgeSources([...expectedKnowledgeSources, selectedContext]);
      setSelectedContext("");
    }
  };

  const handleAddAgent = () => {
    if (selectedAgent && !expectedAgentTools.includes(selectedAgent)) {
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
          <DialogTitle>{isEditing ? "Edit Test Case" : "Create Test Case"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the test case details." : "Create a new test case with conversation inputs and expected outputs."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="conversation">Conversation</TabsTrigger>
              <TabsTrigger value="expected">Expected Tools</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="basic" className="space-y-4 p-1">
                <div className="grid gap-4">
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

              <TabsContent value="conversation" className="space-y-4 p-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Conversation Flow
                    </CardTitle>
                    <CardDescription>
                      Add user messages in order. The agent will respond between each message automatically.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">


                    {/* @ts-ignore */}
                    <Conversation className="overflow-y-hidden">
                      {/* @ts-ignore */}
                      <ConversationContent className="px-6">
                        {inputs?.length > 0 && (
                          <MessageRenderer
                            messages={inputs}
                            status={"ready"}
                            writeAccess={false}
                          />
                        )}
                      </ConversationContent>
                    </Conversation>

                    <div className="space-y-2">
                      <Label htmlFor="currentInput">Add User Message</Label>
                      <div className="space-y-2">
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
                            onClick={handleAddMessage}
                            disabled={loading || (!currentInput.trim() && currentFileParts.length === 0)}
                            className="ml-auto"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Message
                          </Button>
                        </div>

                        {currentFiles && currentFiles.length > 0 && (
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
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Press Enter to add, Shift+Enter for new line. You can attach files to messages.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="expected" className="space-y-4 p-1">
                <div className="grid gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Expected Tools (Optional)</CardTitle>
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
                              className="ml-2 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Select value={selectedTool} onValueChange={setSelectedTool} disabled={loading}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a tool..." />
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
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Expected Knowledge Sources (Optional)</CardTitle>
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
                          <SelectTrigger>
                            <SelectValue placeholder="Select a knowledge source..." />
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
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Expected Agent Tools (Optional)</CardTitle>
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
                          <SelectTrigger>
                            <SelectValue placeholder="Select an agent..." />
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
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !expectedOutput.trim() || inputs.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Test Case" : "Create Test Case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog >
  );
}
