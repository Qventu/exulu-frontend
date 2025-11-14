"use client"

import { useState } from "react"
import { Plus, Trash2, Edit, Shield, Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { useMutation, useQuery } from "@apollo/client"
import { GET_USER_ROLES, CREATE_USER_ROLE, UPDATE_USER_ROLE_BY_ID, REMOVE_USER_ROLE_BY_ID } from "@/queries/queries"
import { RoleForm } from "@/components/role-form"
import { UserRole } from "@/types/models/user-role"

export default function RoleManagement() {
    const [searchTerm, setSearchTerm] = useState("")
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)

    const { loading, error, data, refetch } = useQuery(GET_USER_ROLES, {
        variables: { page: 1, limit: 100 },
        fetchPolicy: "cache-first",
        nextFetchPolicy: "network-only",
    })

    const [createRole, { loading: createLoading }] = useMutation(CREATE_USER_ROLE, {
        refetchQueries: [GET_USER_ROLES, "GetUserRoles"],
    })

    const [updateRole, { loading: updateLoading }] = useMutation(UPDATE_USER_ROLE_BY_ID, {
        refetchQueries: [GET_USER_ROLES, "GetUserRoles"],
    })

    const [deleteRole, { loading: deleteLoading }] = useMutation(REMOVE_USER_ROLE_BY_ID, {
        refetchQueries: [GET_USER_ROLES, "GetUserRoles"],
    })

    const roles: UserRole[] = data?.rolesPagination?.items || []
    const filteredRoles = roles.filter(role =>
        role.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const formatPermissions = (role: UserRole) => {
        const permissions: { name: string; level: string }[] = []
        
        if (role.agents) {
            const agentPerms = role.agents.toLowerCase()
            if (agentPerms.includes('write') || agentPerms.includes('create') || agentPerms.includes('update') || agentPerms.includes('delete')) {
                permissions.push({ name: "Agents", level: "Read/Write" })
            } else if (agentPerms.includes('read') || agentPerms.includes('view')) {
                permissions.push({ name: "Agents", level: "Read" })
            }
        }
        
        if (role.workflows) {
            const workflowPerms = role.workflows.toLowerCase()
            if (workflowPerms.includes('write') || workflowPerms.includes('create') || workflowPerms.includes('update') || workflowPerms.includes('delete')) {
                permissions.push({ name: "Workflows", level: "Read/Write" })
            } else if (workflowPerms.includes('read') || workflowPerms.includes('view')) {
                permissions.push({ name: "Workflows", level: "Read" })
            }
        }
        
        if (role.variables) {
            const variablePerms = role.variables.toLowerCase()
            if (variablePerms.includes('write') || variablePerms.includes('create') || variablePerms.includes('update') || variablePerms.includes('delete')) {
                permissions.push({ name: "Variables", level: "Read/Write" })
            } else if (variablePerms.includes('read') || variablePerms.includes('view')) {
                permissions.push({ name: "Variables", level: "Read" })
            }
        }
        
        if (role.users) {
            const userPerms = role.users.toLowerCase()
            if (userPerms.includes('write') || userPerms.includes('create') || userPerms.includes('update') || userPerms.includes('delete')) {
                permissions.push({ name: "Users", level: "Read/Write" })
            } else if (userPerms.includes('read') || userPerms.includes('view')) {
                permissions.push({ name: "Users", level: "Read" })
            }
        }

        if (role.api) {
            const apiPerms = role.api.toLowerCase()
            if (apiPerms.includes('write') || apiPerms.includes('create') || apiPerms.includes('update') || apiPerms.includes('delete')) {
                permissions.push({ name: "API", level: "Read/Write" })
            } else if (apiPerms.includes('read') || apiPerms.includes('view')) {
                permissions.push({ name: "API", level: "Read" })
            }
        }

        return permissions
    }

    const handleCreateRole = async (roleData: any) => {
        try {
            await createRole({
                variables: {
                    name: roleData.name,
                    agents: roleData.agents,
                    api: roleData.api,
                    workflows: roleData.workflows,
                    variables: roleData.variables,
                    users: roleData.users,
                }
            })
            setCreateDialogOpen(false)
            toast({
                title: "Success",
                description: "Role created successfully",
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to create role",
                variant: "destructive",
            })
        }
    }

    const handleUpdateRole = async (roleData: any) => {
        if (!selectedRole) return
        
        try {
            await updateRole({
                variables: {
                    id: selectedRole.id,
                    name: roleData.name,
                    agents: roleData.agents,
                    api: roleData.api,
                    workflows: roleData.workflows,
                    variables: roleData.variables,
                    users: roleData.users,
                }
            })
            setEditDialogOpen(false)
            setSelectedRole(null)
            toast({
                title: "Success",
                description: "Role updated successfully",
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update role",
                variant: "destructive",
            })
        }
    }

    const handleDeleteRole = async () => {
        if (!selectedRole) return
        
        try {
            await deleteRole({
                variables: { id: selectedRole.id }
            })
            setDeleteDialogOpen(false)
            setSelectedRole(null)
            toast({
                title: "Success",
                description: "Role deleted successfully",
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete role",
                variant: "destructive",
            })
        }
    }

    return (
        <div className="container mx-auto py-6 space-y-8 max-w-7xl">
            <div className="flex flex-col gap-2">
                <Link href="/users">
                    <Button variant="ghost" size="sm" className="mb-2 w-fit">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Users
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
                <p className="text-muted-foreground">
                    Create and manage roles with specific permissions for agents, workflows, variables, the api and users.
                </p>
            </div>

            {/* Search and Create */}
            <Card>
                <CardHeader>
                    <CardTitle>Roles</CardTitle>
                    <CardDescription>
                        Manage system roles and their permissions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <Input
                            placeholder="Search roles..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 max-w-md"
                        />
                        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Role
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Create New Role</DialogTitle>
                                    <DialogDescription>
                                        Define the role name and permissions for different system areas.
                                    </DialogDescription>
                                </DialogHeader>
                                <RoleForm
                                    onSubmit={handleCreateRole}
                                    loading={createLoading}
                                    onCancel={() => setCreateDialogOpen(false)}
                                />
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

            {/* Roles List */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="text-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                            <p className="text-muted-foreground">Loading roles...</p>
                        </div>
                    ) : filteredRoles.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {searchTerm ? "No roles found matching your search." : "No roles created yet. Create your first role above."}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Role Name</TableHead>
                                        <TableHead>Permissions</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Updated</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRoles.map((role) => (
                                        <TableRow key={role.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">{role.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {formatPermissions(role).map((perm, index) => (
                                                        <Badge 
                                                            key={index} 
                                                            variant={"secondary"}
                                                            className="text-xs"
                                                        >
                                                            {perm.name}: {perm.level}
                                                        </Badge>
                                                    ))}
                                                    {formatPermissions(role).length === 0 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            No permissions
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {format(new Date(role.createdAt || ""), "PP hh:mm")}
                                            </TableCell>
                                            <TableCell>
                                                {format(new Date(role.updatedAt || ""), "PP hh:mm")}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Dialog open={editDialogOpen && selectedRole?.id === role.id} onOpenChange={(open) => {
                                                        setEditDialogOpen(open)
                                                        if (!open) setSelectedRole(null)
                                                    }}>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setSelectedRole(role)}
                                                                className="h-8 w-8"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                                            <DialogHeader>
                                                                <DialogTitle>Edit Role</DialogTitle>
                                                                <DialogDescription>
                                                                    Update the role name and permissions.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <RoleForm
                                                                initialData={selectedRole}
                                                                onSubmit={handleUpdateRole}
                                                                loading={updateLoading}
                                                                onCancel={() => {
                                                                    setEditDialogOpen(false)
                                                                    setSelectedRole(null)
                                                                }}
                                                            />
                                                        </DialogContent>
                                                    </Dialog>

                                                    <Dialog open={deleteDialogOpen && selectedRole?.id === role.id} onOpenChange={(open) => {
                                                        setDeleteDialogOpen(open)
                                                        if (!open) setSelectedRole(null)
                                                    }}>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setSelectedRole(role)}
                                                                disabled={role.name === "admin" || role.name === "default"}
                                                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Delete Role</DialogTitle>
                                                                <DialogDescription>
                                                                    Are you sure you want to delete the role "{selectedRole?.name}"? This action cannot be undone.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <DialogFooter>
                                                                <Button 
                                                                    variant="outline" 
                                                                    onClick={() => {
                                                                        setDeleteDialogOpen(false)
                                                                        setSelectedRole(null)
                                                                    }}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                                <Button 
                                                                    variant="destructive" 
                                                                    onClick={handleDeleteRole}
                                                                    disabled={deleteLoading || role.name === "admin" || role.name === "default"}
                                                                >
                                                                    {deleteLoading ? (
                                                                        <>
                                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                            Deleting...
                                                                        </>
                                                                    ) : (
                                                                        "Delete Role"
                                                                    )}
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}