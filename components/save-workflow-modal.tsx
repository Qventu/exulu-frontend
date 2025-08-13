"use client"

import React, { useState, useCallback, useContext, useMemo } from 'react'
import { Message } from '@ai-sdk/react'
import { useMutation, useQuery } from '@apollo/client'
import { UserContext } from '@/app/(application)/authenticated'
import { CREATE_WORKFLOW_TEMPLATE, GET_USERS, GET_USER_ROLES } from '@/queries/queries'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Trash2, Edit2, Users, Lock, Globe, Settings, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

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
}

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Private', description: 'Only you can see this workflow', icon: Lock },
  { value: 'USERS', label: 'Shared with Users', description: 'Share with specific users', icon: Users },
  { value: 'ROLES', label: 'Shared with Roles', description: 'Share with specific roles', icon: Settings },
  { value: 'PUBLIC', label: 'Public', description: 'Anyone can see this workflow', icon: Globe }
]

export function SaveWorkflowModal({ isOpen, onClose, messages, sessionTitle }: SaveWorkflowModalProps) {
  const { user } = useContext(UserContext)
  const { toast } = useToast()

  // Form state
  const [workflowName, setWorkflowName] = useState('')
  const [workflowDescription, setWorkflowDescription] = useState('')
  const [visibility, setVisibility] = useState<'PRIVATE' | 'USERS' | 'ROLES' | 'PUBLIC'>('PRIVATE')
  const [selectedUsers, setSelectedUsers] = useState<{id: string, rights: 'read' | 'write'}[]>([])
  const [selectedRoles, setSelectedRoles] = useState<{id: string, rights: 'read' | 'write'}[]>([])
  const [variables, setVariables] = useState<Variable[]>([])
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [visibilitySelectorOpen, setVisibilitySelectorOpen] = useState(false)
  const [userFilters, setUserFilters] = useState<any[]>([])
  const [userSearchValue, setUserSearchValue] = useState('')

  // GraphQL queries and mutations
  const { data: usersData, loading: usersLoading, refetch: refetchUsers } = useQuery(GET_USERS, {
    variables: { page: 1, limit: 5, filters: userFilters },
    skip: visibility !== 'USERS'
  })

  const { data: rolesData, loading: rolesLoading } = useQuery(GET_USER_ROLES, {
    variables: { page: 1, limit: 100 },
    skip: visibility !== 'ROLES'
  })

  const [createWorkflowTemplate] = useMutation(CREATE_WORKFLOW_TEMPLATE)

  // Reset selected users and roles when visibility changes
  React.useEffect(() => {
    setSelectedUsers([])
    setSelectedRoles([])
  }, [visibility])

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

  // User search function
  const searchUsers = useCallback((value: string) => {
    setUserSearchValue(value)
    const copy = [...userFilters]
    const exists = copy.find((filter) => filter.email)
    if (exists?.email) {
      exists.email.contains = value
    } else {
      copy.push({
        email: {
          contains: value,
        },
      })
    }
    setUserFilters(copy)
    refetchUsers()
  }, [userFilters, refetchUsers])

  // Get selected user objects for display
  const selectedUserObjects = useMemo(() => {
    if (!usersData?.usersPagination?.items) return []
    return usersData.usersPagination.items.filter((user: any) => 
      selectedUsers.some(selected => selected.id === user.id)
    ).map((user: any) => ({
      ...user,
      rights: selectedUsers.find(selected => selected.id === user.id)?.rights || 'read'
    }))
  }, [selectedUsers, usersData])

  // Validation
  const isValid = useMemo(() => {
    if (!workflowName.trim()) return false
    if (steps.length === 0) return false
    if (visibility === 'USERS' && selectedUsers.length === 0) return false
    if (visibility === 'ROLES' && selectedRoles.length === 0) return false
    
    // Check that all user steps have non-empty content after variable replacement
    const userSteps = steps.filter(s => s.type === 'user')
    return userSteps.every(step => {
      const content = step.content || ''
      const withoutVariables = content.replace(/\{[^}]+\}/g, '')
      return withoutVariables.trim().length > 0
    })
  }, [workflowName, steps, visibility, selectedUsers, selectedRoles])

  // Save workflow
  const handleSave = useCallback(async () => {
    if (!isValid || !user?.id) return

    setIsCreating(true)
    
    try {
      const sharedUserIds = visibility === 'USERS' 
        ? selectedUsers.map(user => ({ id: parseInt(user.id), rights: user.rights }))
        : []
      
      const sharedRoleIds = visibility === 'ROLES'
        ? selectedRoles.map(role => ({ id: role.id, rights: role.rights }))
        : []

      const stepsJson = steps.map(step => ({
        id: step.id,
        type: step.type,
        ...(step.type === 'user' && { content: step.content }),
        ...(step.type === 'assistant' && { contentExample: step.contentExample }),
        ...(step.type === 'tool' && { toolName: step.toolName })
      }))

      await createWorkflowTemplate({
        variables: {
          name: workflowName.trim(),
          description: workflowDescription.trim() || null,
          owner: user.id,
          visibility,
          shared_user_ids: sharedUserIds,
          shared_role_ids: sharedRoleIds,
          variables,
          steps_json: stepsJson
        }
      })

      toast({
        title: "Workflow saved!",
        description: `"${workflowName}" has been saved as a workflow template.`
      })

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
  }, [isValid, user?.id, workflowName, workflowDescription, visibility, selectedUsers, selectedRoles, variables, steps, createWorkflowTemplate, toast, onClose])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg">Save as Workflow</DialogTitle>
          <DialogDescription className="text-sm">
            Convert this conversation into a reusable workflow template. Edit your messages and use {`{variable_name}`} syntax to create variables.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 mt-4">
          <div className="space-y-6 pb-6">
            {/* Top Section: Workflow Info + Sharing Side by Side */}
            <div className="flex gap-6">
              {/* Workflow Information */}
              <div className="flex-1 space-y-4">
                <div className="flex gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="workflow-name" className="text-sm font-medium">Workflow Name *</Label>
                    <Input
                      id="workflow-name"
                      value={workflowName}
                      onChange={(e) => setWorkflowName(e.target.value)}
                      placeholder="My Workflow"
                      className="mt-1"
                    />
                  </div>
                  <div className="col-span-1">
                  <Label className="text-sm font-medium flex pb-2">
                        <span className="font-medium">Sharing & Access</span>
                        </Label>

                        <Popover open={visibilitySelectorOpen} onOpenChange={setVisibilitySelectorOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={visibilitySelectorOpen}
                              className="w-full justify-between text-sm capitalize"
                            >
                              {visibility ? visibility : "Select visibility..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Search options..." />
                              <CommandList>
                                <CommandEmpty>No options found.</CommandEmpty>
                                <CommandGroup>
                                  {VISIBILITY_OPTIONS.map((option: any) => (
                                    <CommandItem
                                      key={option.value}
                                      onSelect={() => {
                                        setVisibility(option.value)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          visibility === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{option.label}</span>
                                        <span className="text-xs text-muted-foreground">{option.description}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <div>
                  <Label htmlFor="workflow-description" className="text-sm font-medium">Description</Label>
                  <Textarea
                    id="workflow-description"
                    value={workflowDescription}
                    onChange={(e) => setWorkflowDescription(e.target.value)}
                    placeholder="Describe what this workflow does..."
                    rows={2}
                    className="mt-1 resize-none"
                  />
                </div>
              </div>

              {/* Sharing & Access - Collapsible */}
  
                    {visibility === 'USERS' && (
                      <div className="w-80 border rounded-lg">                
                        <div className="p-4 space-y-4">
                          <div>
                            <Label className="text-sm font-medium">Share with users ({selectedUsers?.length || 0})</Label>
                            
                            {/* Search bar */}
                            <div className="mt-2">
                              <Input
                                placeholder="Search users by email..."
                                value={userSearchValue}
                                onChange={(e) => searchUsers(e.target.value)}
                                className="text-sm"
                              />
                            </div>

                            {/* Search results (max 5) */}
                            {usersLoading && (
                              <div className="mt-2 flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">Loading users...</span>
                              </div>
                            )}
                            {!usersLoading && usersData && usersData.usersPagination.items.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-muted-foreground mb-1">Search Results</div>
                                <div className="max-h-32 overflow-y-auto border rounded-lg">
                                  {usersData.usersPagination.items.slice(0, 5).map((user: any) => (
                                    <label key={user.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedUsers.some(selected => selected.id === user.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedUsers(prev => [...prev, {id: user.id, rights: 'read'}])
                                          } else {
                                            setSelectedUsers(prev => prev.filter(selected => selected.id !== user.id))
                                          }
                                        }}
                                      />
                                      <span className="text-sm">{user.email}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                            {!usersLoading && userSearchValue && usersData && usersData.usersPagination.items.length === 0 && (
                              <div className="mt-2 text-center py-4">
                                <span className="text-sm text-muted-foreground">No users found</span>
                              </div>
                            )}

                            {/* Selected users list */}
                            {selectedUsers.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-muted-foreground mb-1">Selected Users</div>
                                <div className="space-y-1">
                                  {selectedUserObjects.map((user: any) => (
                                    <div key={user.id} className="flex items-center gap-2 border p-2 rounded-lg text-sm">
                                      <span className="flex-1">{user.email}</span>
                                      <Select 
                                        value={user.rights} 
                                        onValueChange={(value: 'read' | 'write') => {
                                          setSelectedUsers(prev => 
                                            prev.map(selected => 
                                              selected.id === user.id 
                                                ? { ...selected, rights: value }
                                                : selected
                                            )
                                          )
                                        }}
                                      >
                                        <SelectTrigger className="h-6 w-16 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="read">Read</SelectItem>
                                          <SelectItem value="write">Write</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0 hover:bg-blue-100"
                                        onClick={() => setSelectedUsers(prev => prev.filter(selected => selected.id !== user.id))}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {visibility === 'ROLES' && (
                                  <div className="w-80 border rounded-lg">                
                <div className="p-4 space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Share with roles ({selectedRoles?.length || 0})</Label>
                        
                        {/* Available roles list */}
                        <div className="mt-2">
                          <div className="text-xs text-muted-foreground mb-1">Available Roles</div>
                          {rolesLoading && (
                            <div className="flex items-center justify-center py-4 border rounded-lg">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span className="text-sm text-muted-foreground">Loading roles...</span>
                            </div>
                          )}
                          {!rolesLoading && rolesData && (
                            <div className="max-h-24 overflow-y-auto border rounded-lg">
                              {rolesData.rolesPagination.items.map((role: any) => (
                                <label key={role.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedRoles.some(selected => selected.id === role.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRoles(prev => [...prev, {id: role.id, rights: 'read'}])
                                      } else {
                                        setSelectedRoles(prev => prev.filter(selected => selected.id !== role.id))
                                      }
                                    }}
                                  />
                                  <span className="text-sm capitalize">{role.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Selected roles list */}
                        {selectedRoles.length > 0 && rolesData && (
                          <div className="mt-2">
                            <div className="text-xs text-muted-foreground mb-1">Selected Roles</div>
                            <div className="space-y-1">
                              {selectedRoles.map((selectedRole: any) => {
                                const role = rolesData.rolesPagination.items.find((r: any) => r.id === selectedRole.id)
                                return (
                                  <div key={selectedRole.id} className="flex items-center gap-2 border p-2 rounded-lg text-sm">
                                    <span className="flex-1 pl-2 capitalize">{role?.name}</span>
                                    <Select 
                                      value={selectedRole.rights} 
                                      onValueChange={(value: 'read' | 'write') => {
                                        setSelectedRoles(prev => 
                                          prev.map(selected => 
                                            selected.id === selectedRole.id 
                                              ? { ...selected, rights: value }
                                              : selected
                                          )
                                        )
                                      }}
                                    >
                                      <SelectTrigger className="h-6 text-xs w-20 border-none">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="read">
                                          <span className="pr-7">Read</span>
                                        </SelectItem>
                                        <SelectItem value="write">
                                          <span className="pr-7">Write</span>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 w-5 p-0 hover:bg-blue-100"
                                      onClick={() => setSelectedRoles(prev => prev.filter(selected => selected.id !== selectedRole.id))}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      </div>
                      </div>
                    )}

            </div>

            <hr/>

            {/* Main Content - Side by Side Layout */}
            <div className="flex gap-6">
              {/* Steps Section */}
              <div className="flex-1">
                <div className="mb-3">
                  <h3 className="font-medium text-sm">Conversation Steps</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Edit your messages and add variables using {`{variable_name}`} syntax
                  </p>
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {steps.map((step) => (
                    <div key={step.id} className="border rounded-md p-3 bg-muted/20">
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
                  ))}
                </div>
              </div>

              {/* Variables Section */}
              <div className="w-80">
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
        </ScrollArea>

        <div className="border-t p-4 bg-background">
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!isValid || isCreating}
            >
              {isCreating ? 'Saving...' : 'Save Workflow'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}