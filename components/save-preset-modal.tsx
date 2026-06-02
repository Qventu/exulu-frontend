"use client"

import React, { useState, useCallback, useContext, useMemo } from 'react'
import { useMutation, useApolloClient } from '@apollo/client'
import { UserContext } from '@/app/(application)/authenticated'
import { CREATE_CONTEXT_PRESET, UPDATE_CONTEXT_PRESET, GET_CONTEXT_PRESETS } from '@/queries/queries'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ChevronDown, Tag, Database } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { RBACControl } from './rbac'
import { Badge } from './ui/badge'
import { parsePresetItemsForDisplay } from '@/lib/validate-preset-items'

interface ContextPreset {
  id: string
  name: string
  description?: string
  preset_items: string[]
  tags?: string[]
  rights_mode?: 'private' | 'users' | 'roles' | 'teams' | 'public'
  RBAC?: {
    users?: Array<{ id: number; rights: 'read' | 'write' }>
    roles?: Array<{ id: string; rights: 'read' | 'write' }>
    teams?: Array<{ id: string; rights: 'read' | 'write' }>
  }
}

interface SavePresetModalProps {
  isOpen: boolean
  onClose: () => void
  currentItems: string[]
  existingPreset?: ContextPreset
  onSave?: (preset: ContextPreset) => void
}

export function SavePresetModal({
  isOpen,
  onClose,
  currentItems,
  existingPreset,
  onSave
}: SavePresetModalProps) {
  const { user } = useContext(UserContext)
  const { toast } = useToast()
  const apolloClient = useApolloClient()

  const isEditing = Boolean(existingPreset)
  const [presetName, setPresetName] = useState(existingPreset?.name || '')
  const [presetDescription, setPresetDescription] = useState(existingPreset?.description || '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(existingPreset?.tags || [])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [rbac, setRbac] = useState<{
    rights_mode: 'private' | 'users' | 'roles' | 'teams' | 'public';
    users: Array<{ id: number; rights: 'read' | 'write' }>;
    roles: Array<{ id: string; rights: 'read' | 'write' }>;
    teams: Array<{ id: string; rights: 'read' | 'write' }>;
  }>({
    rights_mode: existingPreset?.rights_mode || 'private',
    users: existingPreset?.RBAC?.users || [],
    roles: existingPreset?.RBAC?.roles || [],
    teams: existingPreset?.RBAC?.teams || [],
  })

  const [createPreset, { loading: creating }] = useMutation(CREATE_CONTEXT_PRESET, {
    refetchQueries: [GET_CONTEXT_PRESETS, "GetContextPresets"],
  })
  const [updatePreset, { loading: updating }] = useMutation(UPDATE_CONTEXT_PRESET, {
    refetchQueries: [GET_CONTEXT_PRESETS, "GetContextPresets"],
  })

  // Parse current items for display
  const itemStats = useMemo(() => {
    const items = isEditing ? existingPreset?.preset_items || [] : currentItems
    return parsePresetItemsForDisplay(items)
  }, [currentItems, existingPreset, isEditing])

  // Handle adding tags
  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim().toLowerCase()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setTagInput('')
    }
  }, [tagInput, tags])

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }, [tags])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }, [handleAddTag])

  // Save preset
  const handleSave = useCallback(async () => {
    if (!user?.id) return

    if (!presetName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your preset.",
        variant: "destructive"
      })
      return
    }

    try {
      const variables = {
        name: presetName.trim(),
        description: presetDescription.trim() || null,
        preset_items: isEditing ? existingPreset?.preset_items : currentItems,
        tags: tags.length > 0 ? tags : null,
        rights_mode: rbac.rights_mode,
        RBAC: {
          users: rbac.users,
          roles: rbac.roles,
        }
      }

      if (isEditing && existingPreset) {
        const { data } = await updatePreset({
          variables: {
            id: existingPreset.id,
            ...variables
          }
        })

        toast({
          title: "Preset updated!",
          description: `"${presetName}" has been updated successfully.`
        })

        if (onSave && data?.context_presetsUpdateOneById?.item) {
          onSave(data.context_presetsUpdateOneById.item)
        }
      } else {
        const { data } = await createPreset({ variables })

        toast({
          title: "Preset created!",
          description: `"${presetName}" has been saved successfully.`
        })

        if (onSave && data?.context_presetsCreateOne?.item) {
          onSave(data.context_presetsCreateOne.item)
        }
      }

      onClose()
    } catch (error) {
      console.error('Error saving preset:', error)
      toast({
        title: "Error saving preset",
        description: error instanceof Error ? error.message : "There was an error saving your preset. Please try again.",
        variant: "destructive"
      })
    }
  }, [user?.id, presetName, presetDescription, currentItems, tags, rbac, createPreset, updatePreset, toast, onClose, isEditing, existingPreset, onSave])

  const loading = creating || updating

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Context Preset' : 'Save as Context Preset'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your context preset configuration.'
              : 'Save your current context selection as a reusable preset.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preview of selected items */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4" />
              <span>Selected Items</span>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>{itemStats.contextCount} {itemStats.contextCount === 1 ? 'context' : 'contexts'}</span>
              <span className="text-muted-foreground/50">•</span>
              <span>{itemStats.itemCount} specific {itemStats.itemCount === 1 ? 'item' : 'items'}</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="font-medium">{itemStats.contextCount + itemStats.itemCount} total</span>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="preset-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g., Customer Support Knowledge Base"
              className="h-10"
            />
            {!presetName.trim() && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <span>⚠️</span>
                Name is required
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="preset-description">Description</Label>
            <Textarea
              id="preset-description"
              value={presetDescription}
              onChange={(e) => setPresetDescription(e.target.value)}
              placeholder="Describe when to use this preset..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="preset-tags">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </div>
            </Label>
            <div className="flex gap-2">
              <Input
                id="preset-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add tags (press Enter)"
                className="h-10"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive/10"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <span className="ml-1 text-xs">×</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* RBAC */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Sharing & Permissions</h3>
                <p className="text-xs text-muted-foreground">Control who can view and use this preset</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? 'Hide' : 'Show'}
                <ChevronDown className={cn("w-4 h-4 ml-1 transition-transform", showAdvanced && "rotate-180")} />
              </Button>
            </div>
            {showAdvanced ? (
              <RBACControl
                allowedModes={['private', 'users', 'roles', 'teams']}
                initialRightsMode={existingPreset?.rights_mode}
                initialUsers={existingPreset?.RBAC?.users}
                initialRoles={existingPreset?.RBAC?.roles}
                initialTeams={existingPreset?.RBAC?.teams}
                onChange={(rights_mode, users, roles, teams) => {
                  setRbac({ rights_mode, users, roles, teams })
                }}
              />
            ) : (
              <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                Using default permissions (private to you)
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !presetName.trim()}
            className="min-w-[120px]"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {isEditing ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              isEditing ? 'Update Preset' : 'Save Preset'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
