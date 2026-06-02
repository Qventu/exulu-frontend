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
import { GET_TEAMS } from "@/queries/queries"
import { Team } from "@/types/models/team"

interface TeamSelectorProps {
  value?: string
  onChange: (teamId: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function TeamSelector({
  value,
  onChange,
  placeholder = "Select team...",
  className,
  disabled,
}: TeamSelectorProps) {
  const [open, setOpen] = useState(false)

  const { data, loading } = useQuery(GET_TEAMS, {
    variables: { page: 1, limit: 100 },
    fetchPolicy: "cache-first",
  })

  const teams: Team[] = data?.teamsPagination?.items || []
  const selectedTeam = teams.find((team) => team.id === value)

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
              Loading teams...
            </>
          ) : selectedTeam ? (
            selectedTeam.name
          ) : (
            placeholder
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search teams..." />
          <CommandEmpty>No teams found.</CommandEmpty>
          <CommandGroup>
            {teams.map((team) => (
              <CommandItem
                key={team.id}
                value={team.name}
                onSelect={() => {
                  onChange(team.id)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === team.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex-1">
                  <div className="font-medium">{team.name}</div>
                  {team.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {team.description}
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
