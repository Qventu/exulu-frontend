"use client"

import React, { useState, useCallback, useContext, useMemo } from 'react'
import type { UIMessage as Message } from 'ai'
import { useMutation } from '@apollo/client'
import { UserContext } from '@/app/(application)/authenticated'
import { CREATE_WORKFLOW_TEMPLATE, UPDATE_WORKFLOW_TEMPLATE } from '@/queries/queries'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Trash2, Edit2, ChevronDown } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { RBACControl } from './rbac'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Response } from '@/components/ai-elements/response';

interface WorkflowVariable {
  name: string
  description?: string
  type: 'string'
  required: boolean
  defaultValue?: string
}

interface WorkflowStep {
  id: string
  type: 'user' | 'assistant' | 'tool'
  content?: string
  contentExample?: string
  toolName?: string
  variablesUsed?: string[]
}

interface WorkflowTemplate {
  id: string
  name: string
  description?: string
  rights_mode?: 'private' | 'users' | 'roles' | 'public' | 'projects'
  RBAC?: {
    users?: Array<{ id: string; rights: 'read' | 'write' }>
    roles?: Array<{ id: string; rights: 'read' | 'write' }>
    projects?: Array<{ id: string; rights: 'read' | 'write' }>
  }
  variables?: WorkflowVariable[]
  steps_json?: WorkflowStep[]
}

interface SaveWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  messages: Message[]
  sessionTitle?: string
  existingWorkflow?: WorkflowTemplate
  isReadOnly?: boolean
}

export function SaveWorkflowModal({ isOpen, onClose, messages, sessionTitle, existingWorkflow, isReadOnly = false }: SaveWorkflowModalProps) {
  const { user } = useContext(UserContext)
  const { toast } = useToast()
  const [rbac, setRbac] = useState({
    rights_mode: existingWorkflow?.rights_mode || 'private',
    users: existingWorkflow?.RBAC?.users || [],
    roles: existingWorkflow?.RBAC?.roles || [],
    projects: existingWorkflow?.RBAC?.projects || []
  })
  const isEditing = Boolean(existingWorkflow)

  // Form state
  const [workflowName, setWorkflowName] = useState(existingWorkflow?.name || '')
  const [workflowDescription, setWorkflowDescription] = useState(existingWorkflow?.description || '')
  const [variables, setVariables] = useState<WorkflowVariable[]>(existingWorkflow?.variables || [])
  const [steps, setSteps] = useState<WorkflowStep[]>(existingWorkflow?.steps_json || [])
  const [isCreating, setIsCreating] = useState(false)
  const [activeTab, setActiveTab] = useState('setup')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editingVariable, setEditingVariable] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [createWorkflowTemplate] = useMutation(CREATE_WORKFLOW_TEMPLATE)
  const [updateWorkflowTemplate] = useMutation(UPDATE_WORKFLOW_TEMPLATE)

  // Initialize steps from messages
  React.useEffect(() => {
    if (messages.length > 0) {
      const transformedSteps: WorkflowStep[] = []

      messages.forEach((message, index) => {
        const messageContent = (message as any).content || (message.parts ? message.parts.filter(p => p.type === 'text').map(p => p.text).join('\n') : '')

        if (message.role === 'user') {
          transformedSteps.push({
            id: `step_${index + 1}`,
            type: 'user',
            content: messageContent,
            variablesUsed: []
          })
        } else if (message.role === 'assistant') {
          transformedSteps.push({
            id: `step_${index + 1}`,
            type: 'assistant',
            contentExample: messageContent
          })
        } else if (message.role === 'system') {
          // Handle tool calls from message parts
          if (message.parts) {
            message.parts.forEach((part: any, partIndex: number) => {
              if (part.type === 'tool-invocation' && part.toolInvocation) {
                transformedSteps.push({
                  id: `step_${index + 1}_${partIndex}`,
                  type: 'tool',
                  toolName: part.toolInvocation.toolName
                })
              }
            })
          }
        }
      })
      console.log("transformedSteps", transformedSteps)
      setSteps(transformedSteps)
      setWorkflowName(sessionTitle || 'My Workflow')
    }
  }, [messages, sessionTitle, steps.length])

  // Variable management functions
  const createVariable = useCallback((name: string, description?: string) => {
    if (!name.match(/^[A-Za-z_][A-Za-z0-9_]{1,63}$/)) {
      toast({
        title: "Invalid variable name",
        description: "Variable name must start with a letter or underscore, contain only letters, numbers, and underscores, and be 2-64 characters long.",
        variant: "destructive"
      })
      return false
    }

    if (variables.some(v => v.name === name)) {
      return true // Variable already exists, that's fine
    }

    const newVariable: WorkflowVariable = {
      name,
      type: 'string',
      required: true,
      description: description || `Auto-detected variable`
    }

    setVariables(prev => [...prev, newVariable])
    return true
  }, [variables, toast])

  // Auto-detect variables from {variable_name} syntax and update content
  const handleStepContentChange = useCallback((stepId: string, content: string) => {
    // Extract all variables from the content
    const variableMatches = content.match(/\{([A-Za-z_][A-Za-z0-9_]{1,63})\}/g) || []
    const variableNames = variableMatches.map((match: string) => match.slice(1, -1)) // Remove { and }

    // Create variables that don't exist yet
    variableNames.forEach(name => {
      createVariable(name)
    })

    // Update the step content
    setSteps(prev => prev.map(step =>
      step.id === stepId
        ? { ...step, content, variablesUsed: variableNames }
        : step
    ))

    // Remove unused variables
    const allUsedVariables = new Set<string>()
    steps.forEach(step => {
      if (step.id === stepId) {
        // Use the new content for this step
        const matches = content.match(/\{([A-Za-z_][A-Za-z0-9_]{1,63})\}/g) || []
        matches.forEach((match: string) => allUsedVariables.add(match.slice(1, -1)))
      } else if (step.variablesUsed) {
        step.variablesUsed.forEach(varName => allUsedVariables.add(varName))
      }
    })

    // Remove variables that are no longer used anywhere
    setVariables(prev => prev.filter(variable => allUsedVariables.has(variable.name)))
  }, [steps, createVariable])

  const deleteVariable = useCallback((variableName: string) => {
    // Remove variable from variables list
    setVariables(prev => prev.filter(v => v.name !== variableName))

    // Remove variable references from steps
    setSteps(prev => prev.map(step => ({
      ...step,
      content: step.content?.replace(new RegExp(`\\{${variableName}\\}`, 'g'), ''),
      variablesUsed: step.variablesUsed?.filter(v => v !== variableName) || []
    })))
  }, [])

  const renameVariable = useCallback((oldName: string, newName: string) => {
    if (!newName.match(/^[A-Za-z_][A-Za-z0-9_]{1,63}$/)) {
      toast({
        title: "Invalid variable name",
        description: "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores.",
        variant: "destructive"
      })
      return false
    }

    if (variables.some(v => v.name === newName && v.name !== oldName)) {
      toast({
        title: "Variable name already exists",
        description: "A variable with this name already exists.",
        variant: "destructive"
      })
      return false
    }

    // Update variable name
    setVariables(prev => prev.map(v =>
      v.name === oldName ? { ...v, name: newName } : v
    ))

    // Update variable references in steps
    setSteps(prev => prev.map(step => ({
      ...step,
      content: step.content?.replace(new RegExp(`\\{${oldName}\\}`, 'g'), `{${newName}}`),
      variablesUsed: step.variablesUsed?.map(v => v === oldName ? newName : v) || []
    })))

    return true
  }, [variables, toast])

  // Validation
  const isValid = useMemo(() => {
    if (!workflowName.trim()) return false
    if (steps.length === 0) return false
    if (rbac.rights_mode === 'users' && rbac.users?.length === 0) return false
    if (rbac.rights_mode === 'roles' && rbac.roles?.length === 0) return false
    if (rbac.rights_mode === 'projects' && rbac.projects?.length === 0) return false

    // Check that all user steps have non-empty content after variable replacement
    const userSteps = steps.filter(s => s.type === 'user')
    return userSteps.every(step => {
      const content = step.content || ''
      const withoutVariables = content.replace(/\{[^}]+\}/g, '')
      return withoutVariables.trim().length > 0
    })
  }, [workflowName, steps, rbac])

  // Save workflow
  const handleSave = useCallback(async () => {
    if (!isValid || !user?.id) return

    setIsCreating(true)

    try {

      const stepsJson = steps.map(step => ({
        id: step.id,
        type: step.type,
        ...(step.type === 'user' && { content: step.content }),
        ...(step.type === 'assistant' && { contentExample: step.contentExample }),
        ...(step.type === 'tool' && { toolName: step.toolName })
      }))

      if (isEditing && existingWorkflow) {
        await updateWorkflowTemplate({
          variables: {
            id: existingWorkflow.id,
            name: workflowName.trim(),
            description: workflowDescription.trim() || null,
            rights_mode: rbac.rights_mode,
            RBAC: {
              users: rbac.users,
              roles: rbac.roles,
              projects: rbac.projects
            },
            variables,
            steps_json: stepsJson
          }
        })

        toast({
          title: "Workflow updated!",
          description: `"${workflowName}" has been updated successfully.`
        })
      } else {
        await createWorkflowTemplate({
          variables: {
            name: workflowName.trim(),
            description: workflowDescription.trim() || null,
            owner: user.id,
            rights_mode: rbac.rights_mode,
            RBAC: {
              users: rbac.users,
              roles: rbac.roles,
              projects: rbac.projects
            },
            variables,
            steps_json: stepsJson
          }
        })

        toast({
          title: "Workflow created!",
          description: `"${workflowName}" has been saved as a workflow template.`
        })
      }

      onClose()
    } catch (error) {
      console.error('Error saving workflow:', error)
      toast({
        title: "Error saving workflow",
        description: "There was an error saving your workflow. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }, [isValid, user?.id, workflowName, workflowDescription, rbac, variables, steps, createWorkflowTemplate, updateWorkflowTemplate, toast, onClose, isEditing, existingWorkflow])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg">
            {isEditing ? (isReadOnly ? 'View Workflow' : 'Edit Workflow') : 'Save as Workflow'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isEditing
              ? (isReadOnly
                ? 'View workflow details and configuration.'
                : 'Modify this workflow template. Edit your messages and use {variable_name} syntax to create variables.'
              )
              : 'Convert this conversation into a reusable workflow template. Edit your messages and use {variable_name} syntax to create variables.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 mt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="setup" className="data-[state=active]:bg-background">
                Setup & Permissions
              </TabsTrigger>
              <TabsTrigger value="workflow" className="data-[state=active]:bg-background">
                Workflow Steps & Variables
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 pb-6">
              <TabsContent value="setup" className="mt-0 h-full">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="workflow-name" className="text-base font-semibold">Workflow Name *</Label>
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
                          Workflow name is required
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="workflow-description" className="text-base font-semibold">Description</Label>
                      <Textarea
                        id="workflow-description"
                        value={workflowDescription}
                        onChange={(e) => setWorkflowDescription(e.target.value)}
                        placeholder="Describe what this workflow does and when to use it..."
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
                        <p className="text-sm text-muted-foreground">Control who can view and edit this workflow</p>
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
                        initialProjects={existingWorkflow?.RBAC?.projects}
                        onChange={(rights_mode, users, roles, projects) => {
                          setRbac({
                            rights_mode,
                            users,
                            roles,
                            projects
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

                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                      {steps.map((step, index) => (
                        <div key={step.id}>
                          <div className="border rounded-lg p-4 bg-card">
                            <div className="flex items-center gap-3 mb-3">
                              <span className={cn(
                                "text-sm font-medium px-3 py-1 rounded-full",
                                step.type === 'user' ? "bg-blue-100 text-blue-700" :
                                  step.type === 'assistant' ? "bg-green-100 text-green-700" :
                                    "bg-purple-100 text-purple-700"
                              )}>
                                {step.type === 'user' ? '👤 User' :
                                  step.type === 'assistant' ? '🤖 Assistant' :
                                    `🔧 ${step.toolName}`}
                              </span>
                              {step.variablesUsed && step.variablesUsed.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  {step.variablesUsed.map(varName => (
                                    <span key={varName} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-mono border border-blue-200">
                                      {`{${varName}}`}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {step.type === 'user' ? (
                              <div>
                                <Textarea
                                  value={step.content || ''}
                                  onChange={(e) => handleStepContentChange(step.id, e.target.value)}
                                  placeholder="Enter your message..."
                                  className="min-h-[80px] resize-none"
                                  rows={3}
                                  readOnly={isReadOnly}
                                />
                              </div>
                            ) : (
                              <div className="bg-muted/50 p-3 rounded-md">
                                {step.type === 'assistant' ? (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-2">Example response (will be regenerated):</div>
                                    <Response>
                                      {step.contentExample}
                                    </Response>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Tool: {step.toolName}</div>
                                    <div className="text-sm text-muted-foreground">Parameters will be generated dynamically</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {index < steps.length - 1 && (
                            <div className="flex justify-center my-3">
                              <ChevronDown className="w-5 h-5 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right side - Variables */}
                  <div className="w-80">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold mb-2">Variables ({variables.length})</h3>
                      <p className="text-sm text-muted-foreground">Auto-detected from your messages</p>
                    </div>

                    {variables.length > 0 ? (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {variables.map((variable) => (
                          <div key={variable.name} className="border rounded-lg p-3 bg-card">
                            <div className="flex items-start justify-between mb-2">
                              <div className="font-mono text-blue-600 font-medium text-sm">
                                {`{${variable.name}}`}
                              </div>
                              {!isReadOnly && (
                                <div className="flex gap-1">
                                  {editingVariable === variable.name ? (
                                    <Input
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      className="h-6 text-xs font-mono w-20"
                                      placeholder="variable_name"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          if (editingValue && editingValue !== variable.name) {
                                            renameVariable(variable.name, editingValue)
                                          }
                                          setEditingVariable(null)
                                          setEditingValue('')
                                        } else if (e.key === 'Escape') {
                                          setEditingVariable(null)
                                          setEditingValue('')
                                        }
                                      }}
                                      onBlur={() => {
                                        if (editingValue && editingValue !== variable.name) {
                                          renameVariable(variable.name, editingValue)
                                        }
                                        setEditingVariable(null)
                                        setEditingValue('')
                                      }}
                                    />
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={() => {
                                          setEditingVariable(variable.name)
                                          setEditingValue(variable.name)
                                        }}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                                        onClick={() => deleteVariable(variable.name)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                              {variable.description}
                            </div>
                            <div className="flex gap-1">
                              <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                                {variable.type}
                              </span>
                              {variable.required && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                                  required
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <div className="mb-3">
                          <span className="text-3xl">📝</span>
                        </div>
                        <div className="text-sm mb-1 font-medium">No variables yet</div>
                        <div className="text-xs">
                          Use {`{variable_name}`} syntax in your messages
                        </div>
                      </div>
                    )}
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
                  disabled={!isValid || isCreating}
                  className={cn(
                    "min-w-[140px]",
                    !isValid && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {isEditing ? 'Updating...' : 'Saving...'}
                    </>
                  ) : (
                    isEditing ? 'Update Workflow' : 'Save Workflow'
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