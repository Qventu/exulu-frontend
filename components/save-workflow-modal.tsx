"use client"

import React, { useState, useCallback, useContext, useMemo } from 'react'
import { Message } from '@ai-sdk/react'
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

interface Variable {
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

interface SaveWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  messages: Message[]
  sessionTitle?: string
  existingWorkflow?: {
    id: string
    name: string
    description?: string
    rights_mode?: 'private' | 'users' | 'roles' | 'public'
    RBAC?: {
      users?: Array<{ id: string; rights: 'read' | 'write' }>
      roles?: Array<{ id: string; rights: 'read' | 'write' }>
    }
    variables?: Variable[]
    steps_json?: WorkflowStep[]
  }
  isReadOnly?: boolean
}

export function SaveWorkflowModal({ isOpen, onClose, messages, sessionTitle, existingWorkflow, isReadOnly = false }: SaveWorkflowModalProps) {
  const { user } = useContext(UserContext)
  const { toast } = useToast()
  const [rbac, setRbac] = useState({
    rights_mode: existingWorkflow?.rights_mode,
    users: existingWorkflow?.RBAC?.users,
    roles: existingWorkflow?.RBAC?.roles
  })
  const isEditing = Boolean(existingWorkflow)

  // Form state
  const [workflowName, setWorkflowName] = useState(existingWorkflow?.name || '')
  const [workflowDescription, setWorkflowDescription] = useState(existingWorkflow?.description || '')
  const [variables, setVariables] = useState<Variable[]>(existingWorkflow?.variables || [])
  const [steps, setSteps] = useState<WorkflowStep[]>(existingWorkflow?.steps_json || [])
  const [isCreating, setIsCreating] = useState(false)

  const [createWorkflowTemplate] = useMutation(CREATE_WORKFLOW_TEMPLATE)
  const [updateWorkflowTemplate] = useMutation(UPDATE_WORKFLOW_TEMPLATE)

  // Initialize steps from messages
  React.useEffect(() => {
    console.log("messages", messages)
    if (messages.length > 0) {
      const transformedSteps: WorkflowStep[] = []

      messages.forEach((message, index) => {
        if (message.role === 'user') {
          transformedSteps.push({
            id: `step_${index + 1}`,
            type: 'user',
            content: message.content,
            variablesUsed: []
          })
        } else if (message.role === 'assistant') {
          transformedSteps.push({
            id: `step_${index + 1}`,
            type: 'assistant',
            contentExample: message.content
          })
        } else if (message.role === 'system') {
          // Handle tool calls from message parts
          if (message.parts) {
            message.parts.forEach((part, partIndex) => {
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

    const newVariable: Variable = {
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
    const variableNames = variableMatches.map(match => match.slice(1, -1)) // Remove { and }

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
        matches.forEach(match => allUsedVariables.add(match.slice(1, -1)))
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
              roles: rbac.roles
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
              roles: rbac.roles
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
      <DialogContent className="max-w-7xl max-h-[92vh] flex flex-col">
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

        <div className="flex-1 mt-4 space-y-6 pb-6">
          {/* Top Section: Workflow Info + Sharing Side by Side */}
          <div className="flex gap-6">
            {/* Workflow Information */}
            <div className="lg:w-[25%] md:w-[20%] w-full">
              <div className="flex gap-4">
                <div className="col-span-2">
                  <Label htmlFor="workflow-name" className="text-sm font-medium">Workflow Name *</Label>
                  <Input
                    id="workflow-name"
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    placeholder="My Workflow"
                    className="mt-1"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
              <div className="mb-3 mt-2">
                <Label htmlFor="workflow-description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="workflow-description"
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  placeholder="Describe what this workflow does..."
                  rows={2}
                  className="mt-1 resize-none"
                  readOnly={isReadOnly}
                />
              </div>
              <RBACControl
                initialRightsMode={existingWorkflow?.rights_mode}
                initialUsers={existingWorkflow?.RBAC?.users}
                initialRoles={existingWorkflow?.RBAC?.roles}
                onChange={(rights_mode, users, roles) => {
                  console.log("rights_mode", rights_mode)
                  console.log("users", users)
                  console.log("roles", roles)
                  setRbac({
                    rights_mode,
                    users,
                    roles
                  })
                }}
              />
            </div>
            <div className="lg:w-[50%] md:w-[60%] w-full">
              <div className="mb-3">
                <h3 className="font-medium text-sm">Conversation Steps</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Edit your messages and add variables using {`{variable_name}`} syntax
                </p>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {steps.map((step, index) => (
                  <div key={step.id}>
                    <div className="border rounded-md p-3 bg-muted/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded",
                        step.type === 'user' ? "bg-blue-100 text-blue-700" :
                          step.type === 'assistant' ? "bg-gray-100 text-gray-700" :
                            "bg-purple-100 text-purple-700"
                      )}>
                        {step.type === 'user' ? 'User' :
                          step.type === 'assistant' ? 'Assistant' :
                            `Tool: ${step.toolName}`}
                      </span>
                      {step.variablesUsed && step.variablesUsed.length > 0 && (
                        <div className="flex gap-1">
                          {step.variablesUsed.map(varName => (
                            <span key={varName} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">
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
                          className="min-h-[60px] resize-none text-sm"
                          rows={2}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Use {`{variable_name}`} syntax to create variables
                        </p>
                      </div>
                    ) : (
                      <div className="bg-muted/40 p-2 rounded text-sm text-muted-foreground">
                        {step.type === 'assistant' ? (
                          <div>
                            <div className="text-xs text-bold font-medium mb-1">Example response (will be regenerated):</div>
                            <div className="text-xs line-clamp-2">{step.contentExample}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-xs font-medium mb-1">Tool: {step.toolName}</div>
                            <div className="text-xs">Parameters will be generated dynamically</div>
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className="flex justify-center my-2">
                        <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:w-[25%] md:w-[20%] w-full">
              <div className="mb-3">
                <h3 className="font-medium text-sm">Variables ({variables.length})</h3>
                <p className="text-xs text-muted-foreground mt-1">Auto-detected from {`{variable}`} syntax</p>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {variables.map((variable) => (
                  <div key={variable.name} className="border rounded-md p-3 bg-background">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-mono text-sm text-blue-600 font-medium">
                        {`{${variable.name}}`}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-muted"
                          onClick={() => {
                            const newName = prompt('New variable name:', variable.name)
                            if (newName && newName !== variable.name) {
                              renameVariable(variable.name, newName)
                            }
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
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {variable.description}
                    </div>
                    <div className="flex gap-1">
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {variable.type}
                      </span>
                      {variable.required && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">
                          required
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {variables.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="text-sm mb-1">No variables yet.</div>
                    <div className="text-xs">
                      Type {`{variable_name}`} in your messages to create variables
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t p-4 bg-background">
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {isReadOnly ? 'Close' : 'Cancel'}
            </Button>
            {!isReadOnly && (
              <Button
                onClick={handleSave}
                disabled={!isValid || isCreating}
              >
                {isCreating ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? 'Update Workflow' : 'Save Workflow')}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}