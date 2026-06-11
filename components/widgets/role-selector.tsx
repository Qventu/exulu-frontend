"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { GET_USER_ROLES } from "@/queries/queries"

interface Role {
  id: string
  name: string
  agents?: string
  workflows?: string
  variables?: string
  users?: string
}

/** Localized labels for the derived permission summary on each role row. */
export interface RoleSelectorPermissionCopy {
  agents: string
  workflows: string
  variables: string
  users: string
  readWrite: string
  read: string
  none: string
}

const DEFAULT_PERMISSION_COPY: RoleSelectorPermissionCopy = {
  agents: "Agents",
  workflows: "Workflows",
  variables: "Variables",
  users: "Users",
  readWrite: "Read/Write",
  read: "Read",
  none: "No specific permissions configured",
}

interface RoleSelectorProps {
  value?: string
  onChange: (roleId: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /**
   * Localized copy, passed in by the consuming feature (widgets carry no
   * feature namespace of their own). Defaults preserve the pre-i18n English
   * strings for existing consumers.
   */
  loadingText?: string
  searchPlaceholder?: string
  emptyText?: string
  permissionCopy?: RoleSelectorPermissionCopy
}

export function RoleSelector({
  value,
  onChange,
  placeholder = "Select role...",
  className,
  disabled,
  loadingText = "Loading roles...",
  searchPlaceholder = "Search roles...",
  emptyText = "No roles found.",
  permissionCopy = DEFAULT_PERMISSION_COPY,
}: RoleSelectorProps) {
  const [open, setOpen] = useState(false)

  const { data, loading } = useQuery(GET_USER_ROLES, {
    variables: { page: 1, limit: 100 },
    fetchPolicy: "cache-first",
  })

  const roles: Role[] = data?.rolesPagination?.items || []
  const selectedRole = roles.find((role) => role.id === value)

  // Parse permission strings and determine read/write access — same keyword
  // checks and ordering as before, with the labels supplied via props.
  const formatPermissions = (role: Role) => {
    const permissions: string[] = []
    const areas = [
      ["agents", role.agents],
      ["workflows", role.workflows],
      ["variables", role.variables],
      ["users", role.users],
    ] as const

    for (const [area, value] of areas) {
      if (!value) continue
      const perms = value.toLowerCase()
      if (
        perms.includes('write') ||
        perms.includes('create') ||
        perms.includes('update') ||
        perms.includes('delete')
      ) {
        permissions.push(`${permissionCopy[area]}: ${permissionCopy.readWrite}`)
      } else if (perms.includes('read') || perms.includes('view')) {
        permissions.push(`${permissionCopy[area]}: ${permissionCopy.read}`)
      }
    }

    return permissions.length > 0 ? permissions : [permissionCopy.none]
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={loading || disabled}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {loadingText}
            </>
          ) : selectedRole ? (
            selectedRole.name
          ) : (
            placeholder
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup>
            {roles.map((role) => (
              <CommandItem
                key={role.id}
                value={role.name}
                onSelect={() => {
                  onChange(role.id)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === role.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex-1">
                  <div className="font-medium">{role.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPermissions(role).join(", ")}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}