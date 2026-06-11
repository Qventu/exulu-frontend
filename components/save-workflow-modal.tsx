"use client"

import React, { useState, useCallback, useContext, useMemo } from 'react'
import type { FileUIPart, UIMessage as Message, UIMessage } from 'ai'
import { useMutation } from '@apollo/client'
import { UserContext } from '@/app/(application)/authenticated'
import { CREATE_WORKFLOW_TEMPLATE, UPDATE_WORKFLOW_TEMPLATE } from '@/queries/queries'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertCircle, ChevronDown, Plus, Sparkles } from 'lucide-react'
import { toast } from "sonner"
import { cn } from '@/lib/utils'
import { RBACControl } from './rbac'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageRenderer } from './message-renderer'
import { Conversation, ConversationContent } from './ai-elements/conversation'
import UppyDashboard, { FileItem, getPresignedUrl } from "@/components/uppy-dashboard";

interface WorkflowTemplate {
  id: string
  name: string
  description?: string
  rights_mode?: 'private' | 'users' | 'roles' | 'teams' | 'public' /* | 'projects' */
  RBAC?: {
    users?: Array<{ id: number; rights: 'read' | 'write' }>
    roles?: Array<{ id: string; rights: 'read' | 'write' }>
    teams?: Array<{ id: string; rights: 'read' | 'write' }>
    // projects?: Array<{ id: string; rights: 'read' | 'write' }>
  }
  steps_json?: Message[]
}

interface SaveWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  messages: Message[]
  agentId?: string
  sessionTitle?: string
  existingWorkflow?: WorkflowTemplate
  isReadOnly?: boolean
}

export function SaveWorkflowModal({ isOpen, onClose, messages, sessionTitle, existingWorkflow, isReadOnly = false, agentId }: SaveWorkflowModalProps) {
  const { user } = useContext(UserContext)
  const [rbac, setRbac] = useState<{
    rights_mode: 'private' | 'users' | 'roles' | 'teams' | 'public';
    users: Array<{ id: number; rights: 'read' | 'write' }>;
    roles: Array<{ id: string; rights: 'read' | 'write' }>;
    teams: Array<{ id: string; rights: 'read' | 'write' }>;
  }>({
    rights_mode: existingWorkflow?.rights_mode || 'private',
    users: existingWorkflow?.RBAC?.users || [],
    roles: existingWorkflow?.RBAC?.roles || [],
    teams: existingWorkflow?.RBAC?.teams || [],
    // projects: existingWorkflow?.RBAC?.projects || []
  })

  const createPlaceholderMessage = (): UIMessage => {
    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      metadata: {
        type: "placeholder",
      },
      parts: [{
        type: "text",
        text: "💬 Placeholder, generated agent response will be added here when the template is run...",
      }],
    };
  }

  const isEditing = Boolean(existingWorkflow)
  const [workflowName, setWorkflowName] = useState(existingWorkflow?.name || '')
  const [workflowDescription, setWorkflowDescription] = useState(existingWorkflow?.description || '')
  const [inputs, setInputs] = useState<UIMessage[]>();
  const [currentInput, setCurrentInput] = useState("");
  const [currentFiles, setCurrentFiles] = useState<string[] | null>(null);
  const [currentFileParts, setCurrentFileParts] = useState<FileUIPart[]>([]);
  const [isCreating, setIsCreating] = useState(false)
  const [activeTab, setActiveTab] = useState('setup')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [createWorkflowTemplate, { loading: creating }] = useMutation(CREATE_WORKFLOW_TEMPLATE)
  const [updateWorkflowTemplate, { loading: updating }] = useMutation(UPDATE_WORKFLOW_TEMPLATE)

  // Initialize steps from messages
  React.useEffect(() => {
    if (messages.length > 0) {
      const initialInputs: UIMessage[] = []
      for (const step of messages) {
        if (step.role === 'user') {
          initialInputs.push(step)
        } else {
          initialInputs.push(createPlaceholderMessage())
        }
      }
      setInputs(initialInputs);
      setWorkflowName(sessionTitle || 'My Workflow')
    }
  }, [messages, sessionTitle])

  // Save workflow
  const handleSave = useCallback(async () => {
    if (!user?.id) return

    setIsCreating(true)

    try {

      if (isEditing && existingWorkflow) {
        await updateWorkflowTemplate({
          variables: {
            id: existingWorkflow.id,
            name: workflowName.trim(),
            description: workflowDescription.trim() || null,
            rights_mode: rbac.rights_mode,
            agent: agentId,
            RBAC: {
              users: rbac.users,
              roles: rbac.roles,
              // projects: rbac.projects
            },
            steps_json: inputs
          }
        })

        toast.success("Workflow updated!", { description: `"${workflowName}" has been updated successfully.` })

      } else {
        await createWorkflowTemplate({
          variables: {
            name: workflowName.trim(),
            description: workflowDescription.trim() || null,
            owner: user.id,
            rights_mode: rbac.rights_mode,
            agent: agentId,
            RBAC: {
              users: rbac.users,
              roles: rbac.roles,
              // projects: rbac.projects
            },
            steps_json: inputs
          }
        })

        toast.success("Workflow created!", { description: `"${workflowName}" has been saved as a workflow template.` })

      }

      onClose()
    } catch (error) {
      console.error('Error saving workflow:', error)
      toast.error("Error saving workflow", { description: "There was an error saving your workflow. Please try again." })
    } finally {
      setIsCreating(false)
    }
  }, [user?.id, workflowName, workflowDescription, rbac, inputs, createWorkflowTemplate, updateWorkflowTemplate, toast, onClose, isEditing, existingWorkflow])

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
      id: `msg-${Date.now()}`,
      role: "user",
      parts,
    };

    // wait 1 second to avoid the new message and the placeholder message having the same id to avoid the issue of the placeholder message being deleted when the new message is added
    await new Promise(resolve => setTimeout(resolve, 1000));

    setInputs([...(inputs || []), newMessage, createPlaceholderMessage()]);
    setCurrentInput("");
    setCurrentFiles(null);
    setCurrentFileParts([]);
  };

  const loading = creating || updating;

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">
            {isEditing ? (isReadOnly ? 'View Routine' : 'Edit Routine') : 'Save as Routine'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isEditing
              ? (isReadOnly
                ? 'View template details and configuration.'
                : 'Modify this template. Edit your messages and use {variable_name} syntax to create variables.'
              )
              : 'Convert this conversation into a reusable routine. Edit your messages and use {variable_name} syntax to create variables.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="setup" className="data-[state=active]:bg-background">
                Setup & Permissions
              </TabsTrigger>
              <TabsTrigger value="workflow" className="data-[state=active]:bg-background">
                Template Steps & Variables
              </TabsTrigger>
            </TabsList>

            <div className="flex-1">
              <TabsContent value="setup" className="mt-0 h-full">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="workflow-name" className="text-base font-semibold">Template Name *</Label>
                      <Input
                        id="workflow-name"
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                        placeholder="My Workflow"
                        className="mt-2 h-11"
                        readOnly={isReadOnly}
                      />
                      {!workflowName.trim() && (
                        <p className="text-sm text-destructive mt-1 flex items-center">
                          <span className="mr-1">⚠️</span>
                          Template name is required
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="workflow-description" className="text-base font-semibold">Description</Label>
                      <Textarea
                        id="workflow-description"
                        value={workflowDescription}
                        onChange={(e) => setWorkflowDescription(e.target.value)}
                        placeholder="Describe what this template does and when to use it..."
                        rows={3}
                        className="mt-2 resize-none"
                        readOnly={isReadOnly}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-semibold mb-1">Sharing & Permissions</h3>
                        <p className="text-sm text-muted-foreground">Control who can view and edit this template</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="ml-4"
                      >
                        {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                        <ChevronDown className={cn("w-4 h-4 ml-1 transition-transform", showAdvanced && "rotate-180")} />
                      </Button>
                    </div>
                    {showAdvanced && (
                      <RBACControl
                        initialRightsMode={existingWorkflow?.rights_mode}
                        initialUsers={existingWorkflow?.RBAC?.users}
                        initialRoles={existingWorkflow?.RBAC?.roles}
                        initialTeams={existingWorkflow?.RBAC?.teams}
                        // initialProjects={existingWorkflow?.RBAC?.projects}
                        onChange={(rights_mode, users, roles, teams) => {
                          setRbac({
                            rights_mode,
                            users,
                            roles,
                            teams,
                            // projects
                          })
                        }}
                      />
                    )}
                    {!showAdvanced && (
                      <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                        Using default permissions (private to you)
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="workflow" className="mt-0 h-full">
                <div className="h-full flex gap-6">
                  {/* Left side - Messages */}
                  <div className="flex-1">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold mb-2">Conversation Steps</h3>
                      <div className="border rounded-lg p-3 mb-4">
                        <p className="text-sm">
                          💡 <strong>Pro tip:</strong> Use {`{variable_name}`} syntax in your messages to create reusable variables. For example you can use {`{company_name}`} to create a variable for the company name
                          so you can reuse this flow template with different companies.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 pr-2 gap-4">

                      {inputs?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-muted rounded-lg">
                          <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
                          <h3 className="font-semibold text-lg mb-2">No messages yet</h3>
                          <p className="text-sm text-muted-foreground max-w-sm">
                            Start building your template conversation by adding user messages below.
                          </p>
                        </div>
                      ) : (
                        /* @ts-ignore */
                        <Conversation className="max-h-[350px] overflow-y-auto border rounded-lg bg-muted/30 transition-all duration-300 ease-in-out">
                          {/* @ts-ignore */}
                          <ConversationContent className="px-6 py-8">
                            <div className="animate-in fade-in duration-500 space-y-4">
                              <MessageRenderer
                                messages={inputs || []}
                                config={{
                                  marginTopFirstMessage: 'mt-0',
                                  customAssistantClassnames: 'px-4 py-4 border-l-2 border-primary/30'
                                }}
                                onUpdate={(messages) => {
                                  setInputs(messages)
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
                        <Label htmlFor="currentInput" className="text-sm font-semibold">Add User Message</Label>
                        <div className="space-y-3">
                          <Textarea
                            id="currentInput"
                            placeholder="Type the user's message..."
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
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="border-t p-4 bg-background">
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {isReadOnly ? 'Close' : 'Cancel'}
            </Button>
            {!isReadOnly && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={isCreating}
                  className={cn(
                    "min-w-[140px]",
                  )}
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {isEditing ? 'Updating...' : 'Saving...'}
                    </>
                  ) : (
                    isEditing ? 'Update Template' : 'Save Template'
                  )}
                </Button>

              </>

            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}