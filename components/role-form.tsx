"use client"

import { useState, useEffect } from "react"
import { Loader2, Shield, Users, Workflow, Variable, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface Role {
    id?: string
    name: string
    agents?: string
    workflows?: string
    variables?: string
    users?: string
}

interface RoleFormProps {
    initialData?: Role | null
    onSubmit: (roleData: any) => Promise<void>
    loading: boolean
    onCancel: () => void
}

const PERMISSION_OPTIONS = [
    { value: "", label: "No Access", description: "Cannot access this resource" },
    { value: "read", label: "Read Only", description: "Can view but not modify" },
    { value: "write", label: "Read/Write", description: "Full access to create, read, update, and delete" },
]

const PERMISSION_AREAS = [
    {
        key: "agents" as const,
        label: "Agents",
        icon: Bot,
        description: "AI agents and their configurations"
    },
    {
        key: "workflows" as const,
        label: "Workflows", 
        icon: Workflow,
        description: "Workflow templates and executions"
    },
    {
        key: "variables" as const,
        label: "Variables",
        icon: Variable,
        description: "Environment variables and secrets"
    },
    {
        key: "users" as const,
        label: "Users",
        icon: Users,
        description: "User management and roles"
    }
]

export function RoleForm({ initialData, onSubmit, loading, onCancel }: RoleFormProps) {
    const [name, setName] = useState(initialData?.name || "")
    const [permissions, setPermissions] = useState({
        agents: initialData?.agents || "",
        workflows: initialData?.workflows || "",
        variables: initialData?.variables || "",
        users: initialData?.users || "",
    })

    useEffect(() => {
        if (initialData) {
            setName(initialData.name)
            setPermissions({
                agents: initialData.agents || "",
                workflows: initialData.workflows || "",
                variables: initialData.variables || "",
                users: initialData.users || "",
            })
        }
    }, [initialData])

    const handlePermissionChange = (area: keyof typeof permissions, value: string) => {
        setPermissions(prev => ({
            ...prev,
            [area]: value
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!name.trim()) {
            return
        }

        const roleData = {
            name: name.trim(),
            agents: permissions.agents || null,
            workflows: permissions.workflows || null,
            variables: permissions.variables || null,
            users: permissions.users || null,
        }

        await onSubmit(roleData)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Role Name */}
            <div className="space-y-2">
                <Label htmlFor="roleName">Role Name</Label>
                <Input
                    id="roleName"
                    placeholder="e.g. Admin, Developer, Viewer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    required
                />
            </div>

            {/* Permissions */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-medium">Permissions</h3>
                    <p className="text-sm text-muted-foreground">
                        Configure access levels for different areas of the system
                    </p>
                </div>

                {PERMISSION_AREAS.map((area) => {
                    const Icon = area.icon
                    return (
                        <Card key={area.key}>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Icon className="h-4 w-4" />
                                    {area.label}
                                </CardTitle>
                                <CardDescription className="text-sm">
                                    {area.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <RadioGroup
                                    value={permissions[area.key]}
                                    onValueChange={(value) => handlePermissionChange(area.key, value)}
                                    disabled={loading}
                                >
                                    {PERMISSION_OPTIONS.map((option) => (
                                        <div key={option.value} className="flex items-center space-x-2">
                                            <RadioGroupItem value={option.value} id={`${area.key}-${option.value}`} />
                                            <Label 
                                                htmlFor={`${area.key}-${option.value}`}
                                                className="flex-1 cursor-pointer"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">{option.label}</span>
                                                    <span className="text-sm text-muted-foreground">
                                                        {option.description}
                                                    </span>
                                                </div>
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading || !name.trim()}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {initialData ? "Updating..." : "Creating..."}
                        </>
                    ) : (
                        <>
                            <Shield className="mr-2 h-4 w-4" />
                            {initialData ? "Update Role" : "Create Role"}
                        </>
                    )}
                </Button>
            </div>
        </form>
    )
}