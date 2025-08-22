
import {
  GET_USER_ROLES,
  GET_USERS,
  GET_USER_BY_ID
} from "@/queries/queries";
import { useState, useEffect, useCallback } from "react";
import { useApolloClient, useQuery } from "@apollo/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "@/types/models/user";
import { Check, ChevronsUpDown, Users, Lock, Globe, Settings, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "./ui/label";

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private', description: 'Only you can see this agent', icon: Lock },
  { value: 'users', label: 'Shared with Users', description: 'Share with specific users', icon: Users },
  { value: 'roles', label: 'Shared with Roles', description: 'Share with specific roles', icon: Settings },
  { value: 'public', label: 'Public', description: 'Anyone can see this agent', icon: Globe }
]

export function RBACControl({
  initialRightsMode,
  initialUsers,
  initialRoles,
  onChange
}: {
  initialRightsMode: 'private' | 'users' | 'roles' | 'public' | undefined,
  initialUsers: { id: string, rights: 'read' | 'write' }[] | undefined,
  initialRoles: { id: string, rights: 'read' | 'write' }[] | undefined,
  onChange: (rights_mode: 'private' | 'users' | 'roles' | 'public', users: { id: string, rights: 'read' | 'write' }[], roles: { id: string, rights: 'read' | 'write' }[]) => void
}) {
  const [visibility, setVisibility] = useState<'private' | 'users' | 'roles' | 'public' | undefined>(initialRightsMode)
  const [selectedUsers, setSelectedUsers] = useState<{ id: string, rights: 'read' | 'write' }[]>(initialUsers || [])
  const [selectedRoles, setSelectedRoles] = useState<{ id: string, rights: 'read' | 'write' }[]>(initialRoles || [])
  const [hydratedUsers, setHydratedUsers] = useState<User[]>([])
  const [visibilitySelectorOpen, setVisibilitySelectorOpen] = useState(false)
  const [userFilters, setUserFilters] = useState<any[]>([])
  const [userSearchValue, setUserSearchValue] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const client = useApolloClient()

  // GraphQL queries for RBAC
  const { data: usersData, loading: usersLoading, refetch: refetchUsers } = useQuery(GET_USERS, {
    variables: { page: 1, limit: 5, filters: userFilters },
    skip: visibility !== 'users' || !userSearchValue
  })

  const roles = useQuery(GET_USER_ROLES, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: 30,
      filters: [
        {
          type: {
            ne: "api"
          }
        }
      ]
    },
  });


  // User search function
  const searchUsers = useCallback((value: string) => {
    setUserSearchValue(value)
    const copy = [...userFilters, {
      type: {
        ne: "api"
      }
    }]
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

  const hydrateUsers = async (max: number  = 5) => {
    setModalLoading(true)
    if (!selectedUsers || selectedUsers.length === 0) {
      setHydratedUsers([])
      setModalLoading(false)
      return
    }

    const promises = selectedUsers?.slice(0, max).map(async ({ id, rights }) => {
      const user = await client.query({
        query: GET_USER_BY_ID,
        variables: {
          id
        }
      })
      return {
        ...user.data.userById,
        rights
      };
    })
    const results = await Promise.all(promises)
    setHydratedUsers(results)
    setModalLoading(false)
  }

  useEffect(() => {
    hydrateUsers(5)
  }, [])

  useEffect(() => {
    console.log("selectedUsers", selectedUsers)
    console.log("hydratedUsers", hydratedUsers)
    onChange(visibility as 'private' | 'users' | 'roles' | 'public', selectedUsers, selectedRoles)
  }, [visibility, selectedUsers, selectedRoles])

  return (
    <>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Visibility & Sharing</Label>
        <Popover open={visibilitySelectorOpen} onOpenChange={setVisibilitySelectorOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={visibilitySelectorOpen}
              className="w-full justify-between text-sm capitalize"
            >
              {VISIBILITY_OPTIONS.find(option => option.value === visibility)?.label || "Select visibility..."}
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
                        if (option.value !== "users") {
                          setSelectedUsers([])
                        }
                        if (option.value !== "roles") {
                          setSelectedRoles([])
                        }
                        setVisibility(option.value)
                        setVisibilitySelectorOpen(false)
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

      {/* Users sharing section */}
      {visibility === 'users' && (
        <div className="space-y-3 pt-3">
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

            {/* Search results */}
            {usersLoading && (
              <div className="mt-2 flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading users...</span>
              </div>
            )}
            {!usersLoading && usersData && usersData.usersPagination?.items.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-muted-foreground mb-1">Search Results:</div>
                <div className="max-h-50 overflow-y-auto border rounded-lg">
                  {usersData.usersPagination.items.filter(user => !selectedUsers.some(selected => selected.id === user.id)).map((user: any) => (
                    <label key={user.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUsers.some(selected => selected.id === user.id)}
                        onChange={(e) => {
                          setSelectedUsers(prev => [...prev, { id: user.id, rights: 'read' }])
                          setHydratedUsers(prev => [...prev, {
                            ...user,
                            rights: 'read'
                          }])
                        }}
                      />
                      <span className="text-sm">{user.email}</span>
                    </label>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  <span className="font-medium">Note:</span> Only the first 5 users are shown, use the Search bar to find more users.
                </div>
              </div>
            )}
            {!usersLoading && userSearchValue && usersData && usersData.usersPagination.items.length === 0 && (
              <div className="mt-2 text-center py-4">
                <span className="text-sm text-muted-foreground">No users found</span>
              </div>
            )}

            {/* Selected users list */}
            {hydratedUsers?.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-muted-foreground mb-1">Selected Users:</div>
                <div className="space-y-1">
                  {hydratedUsers?.slice(0, 5).map((user: any) => (
                    <div key={user.id} className="flex items-center gap-2 border p-2 rounded-lg text-sm">
                      <span className="flex-1 pl-2">{user.email}</span>
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
                          setHydratedUsers(prev =>
                            prev.map(hydratedUser =>
                              hydratedUser.id === user.id
                                ? { ...hydratedUser, rights: value }
                                : hydratedUser
                            )
                          )
                        }}
                      >
                        <SelectTrigger className="h-6 w-20 text-xs">
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
                        onClick={() => {
                          setSelectedUsers(prev => prev.filter(selected => selected.id !== user.id))
                          setHydratedUsers(prev => prev.filter(hydratedUser => hydratedUser.id !== user.id))
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {selectedUsers && selectedUsers.length > 5 && (
                    <Button
                      variant="link"
                      type="button"
                      className="h-auto p-0 text-blue-600 hover:text-blue-800 text-xs"
                      onClick={() => {
                        hydrateUsers(50)
                        setModalOpen(true)
                      }}
                    >
                      + {selectedUsers.length - 5} more users
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roles sharing section */}
      {visibility === 'roles' && (
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Share with roles ({selectedRoles?.length || 0})</Label>

            {/* Available roles list */}
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">Available Roles</div>
              {roles.loading && (
                <div className="flex items-center justify-center py-4 border rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading roles...</span>
                </div>
              )}
              {!roles.loading && roles.data && (
                <div className="max-h-24 overflow-y-auto border rounded-lg">
                  {roles.data.rolesPagination.items.map((role: any) => (
                    <label key={role.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRoles.some(selected => selected.id === role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoles(prev => [...prev, { id: role.id, rights: 'read' }])
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
            {selectedRoles.length > 0 && roles.data && (
              <div className="mt-2">
                <div className="text-xs text-muted-foreground mb-1">Selected Roles:</div>
                <div className="space-y-1">
                  {selectedRoles.map((selectedRole: any) => {
                    const role = roles.data.rolesPagination.items.find((r: any) => r.id === selectedRole.id)
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
                          onClick={() => {
                            setSelectedRoles(prev => prev.filter(selected => selected.id !== selectedRole.id))
                          }}
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
      )}

      {/* Modal for viewing all selected users */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen} >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>All Selected Users ({selectedUsers?.length || 0})</DialogTitle>
            <DialogDescription>
              View and manage all selected users and their permissions
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {modalLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading users...</span>
              </div>
            )}

            {!modalLoading && hydratedUsers.length > 0 && (
              <div className="space-y-2">
                {hydratedUsers.map((user: any) => (
                  <div key={user.id} className="flex items-center gap-3 border p-3 rounded-lg">
                    <span className="flex-1">{user.email}</span>
                    <Select
                      value={user.rights}
                      onValueChange={(value: 'read' | 'write') => {
                        // Update selectedUsers state
                        setSelectedUsers(prev =>
                          prev.map(selected =>
                            selected.id === user.id
                              ? { ...selected, rights: value }
                              : selected
                          )
                        )
                        // Update hydratedUsers state if this user is in the first 5
                        setHydratedUsers(prev =>
                          prev.map(hydratedUser =>
                            hydratedUser.id === user.id
                              ? { ...hydratedUser, rights: value }
                              : hydratedUser
                          )
                        )
                      }}
                    >
                      <SelectTrigger className="w-24">
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
                      className="h-8 w-8 p-0 hover:bg-destructive/10"
                      onClick={() => {
                        setSelectedUsers(prev => prev.filter(selected => selected.id !== user.id))
                        setHydratedUsers(prev => prev.filter(hydratedUser => hydratedUser.id !== user.id))
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!modalLoading && hydratedUsers.length === 0 && (
              <div className="text-center py-8">
                <span className="text-sm text-muted-foreground">No users selected</span>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog >
    </>
  )
}