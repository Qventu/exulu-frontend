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

interface RoleSelectorProps {
  value?: string
  onChange: (roleId: string) => void
  placeholder?: string
  className?: string
}

export function RoleSelector({
  value,
  onChange,
  placeholder = "Select role...",
  className,
}: RoleSelectorProps) {
  const [open, setOpen] = useState(false)

  const { data, loading } = useQuery(GET_USER_ROLES, {
    variables: { page: 1, limit: 100 },
    fetchPolicy: "cache-first",
  })

  const roles: Role[] = data?.rolesPagination?.items || []
  const selectedRole = roles.find((role) => role.id === value)

  const formatPermissions = (role: Role) => {
    const permissions: string[] = []

    // Parse permission strings and determine read/write access
    if (role.agents) {
      const agentPerms = role.agents.toLowerCase()
      if (agentPerms.includes('write') || agentPerms.includes('create') || agentPerms.includes('update') || agentPerms.includes('delete')) {
        permissions.push("Agents: Read/Write")
      } else if (agentPerms.includes('read') || agentPerms.includes('view')) {
        permissions.push("Agents: Read")
      }
    }

    if (role.workflows) {
      const workflowPerms = role.workflows.toLowerCase()
      if (workflowPerms.includes('write') || workflowPerms.includes('create') || workflowPerms.includes('update') || workflowPerms.includes('delete')) {
        permissions.push("Workflows: Read/Write")
      } else if (workflowPerms.includes('read') || workflowPerms.includes('view')) {
        permissions.push("Workflows: Read")
      }
    }

    if (role.variables) {
      const variablePerms = role.variables.toLowerCase()
      if (variablePerms.includes('write') || variablePerms.includes('create') || variablePerms.includes('update') || variablePerms.includes('delete')) {
        permissions.push("Variables: Read/Write")
      } else if (variablePerms.includes('read') || variablePerms.includes('view')) {
        permissions.push("Variables: Read")
      }
    }

    if (role.users) {
      const userPerms = role.users.toLowerCase()
      if (userPerms.includes('write') || userPerms.includes('create') || userPerms.includes('update') || userPerms.includes('delete')) {
        permissions.push("Users: Read/Write")
      } else if (userPerms.includes('read') || userPerms.includes('view')) {
        permissions.push("Users: Read")
      }
    }

    return permissions.length > 0 ? permissions : ["No specific permissions configured"]
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading roles...
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
          <CommandInput placeholder="Search roles..." />
          <CommandEmpty>No roles found.</CommandEmpty>
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