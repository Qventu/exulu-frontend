"use client"
import { useState } from "react"
import { Copy, Key, Loader2, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { RoleSelector } from "@/components/ui/role-selector"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {useMutation, useQuery} from "@apollo/client";
import {CREATE_API_USER, GET_AGENTS, GET_USERS, REMOVE_USER_BY_ID, UPDATE_USER_BY_ID} from "@/queries/queries";
import bcrypt from "bcryptjs";
const SALT_ROUNDS = 12;
// we dont decrypt, as we only show the key once to the user

// Type for API key
interface ApiKey {
    id: string
    name: string
    key: string
    createdAt: Date
    last_used?: Date
}

export default function ApiKeyManagement() {

    const [newKeyName, setNewKeyName] = useState("")
    const [selectedRole, setSelectedRole] = useState<string>("")
    const [scopeMode, setScopeMode] = useState<"admin" | "agents">("admin")
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
    const [isGenerating, setIsGenerating] = useState(false)
    const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<ApiKey | null>(null)
    const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null)

    const { data: agentsData } = useQuery(GET_AGENTS, {
        fetchPolicy: "cache-first",
        variables: { page: 1, limit: 500 },
    })
    const agentList: Array<{ id: string; name: string }> =
        agentsData?.agentsPagination?.items ?? []

    const { loading, error, data, refetch, previousData } = useQuery(GET_USERS, {
        fetchPolicy: "cache-first",
        nextFetchPolicy: "network-only",
        variables: {
            page: 1,
            limit: 10,
            filters: [{
                type: { eq: "api"}
            }],
        },
        pollInterval: 30000, // polls every 30 seconds for updates on users
    });

    console.log("data", data)

    // Generate new API key
    const generateApiKey = async () => {
        if (!newKeyName.trim()) {
            toast({
                title: "Error",
                description: "Please enter a name for your API key",
                variant: "destructive",
            })
            return
        }

        setIsGenerating(true)

        if (scopeMode === "agents" && selectedAgentIds.length === 0) {
            toast({
                title: "Error",
                description: "Select at least one agent for an agents-scoped key.",
                variant: "destructive",
            })
            setIsGenerating(false)
            return
        }

        const plainKey = `sk_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
        const postFix = `/${newKeyName.toLowerCase().trim().replaceAll(" ", "_")}`
        const encryptedKey = await bcrypt.hash(plainKey, SALT_ROUNDS);
        const response = await createApiUser({
            variables: {
                firstname: `${newKeyName}`,
                type: "api",
                apikey: `${encryptedKey}${postFix}`,
                email: `${encryptedKey}@exulu-api-user.com`,
                role: scopeMode === "admin" ? (selectedRole || undefined) : undefined,
                super_admin: scopeMode === "admin",
                scope_mode: scopeMode,
                agent_ids: scopeMode === "agents" ? selectedAgentIds : undefined,
            }
        })

        console.log("response", response)
        setNewlyGeneratedKey({
            id: `${response.data?.usersCreateOne?.item?.id}`,
            name: newKeyName,
            key: `${plainKey}${postFix}`,
            createdAt: new Date()
        })
        setNewKeyName("")
        setSelectedRole("")
        setScopeMode("admin")
        setSelectedAgentIds([])
        setIsGenerating(false)
    }

    const [removeApiUser, removeApiUserResult] = useMutation(REMOVE_USER_BY_ID, {
        refetchQueries: [
            GET_USERS,
            "GetUsers",
        ],
    });

    const [ createApiUser, createApiUserResult] = useMutation(CREATE_API_USER, {
        refetchQueries: [
            GET_USERS, 
            "GetUsers",
        ],
    });

    const [ updateUser, updateUserResult] = useMutation(UPDATE_USER_BY_ID, {
        refetchQueries: [
            GET_USERS, 
            "GetUsers",
        ],
    });

    // Copy API key to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast({
            title: "Copied!",
            description: "API key copied to clipboard",
        })
    }

    // Delete API key
    const deleteApiKey = async (id: string) => {
        await removeApiUser({
            variables: {
                id
            }
        })
        setDeleteKeyId(null)
        toast({
            title: "Deleted",
            description: "API key has been deleted",
        })
    }

    // Update API key role
    const updateApiKeyRole = async (userId: string, roleId: string) => {
        try {
            await updateUser({
                variables: {
                    id: userId,
                    role: roleId || null
                }
            })
            toast({
                title: "Updated",
                description: "API key role has been updated",
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update API key role",
                variant: "destructive",
            })
        }
    }

    return (
        <div className="container mx-auto py-6 space-y-8 max-w-5xl">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
                <p className="text-muted-foreground">
                    Manage your API keys for accessing the Exulu IMP API. Keep your keys secure - they have full access to your account.
                </p>
            </div>

            {/* Create new API key */}
            <Card>
                <CardHeader>
                    <CardTitle>Create API Key</CardTitle>
                    <CardDescription>
                        Generate a new API key for your applications. API keys provide full access to your account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4 sm:flex-row">
                            <Input
                                placeholder="API Key Name (e.g. Production, Development)"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                className="flex-1"
                            />
                            <div className="sm:w-64">
                                <RoleSelector
                                    value={selectedRole}
                                    onChange={setSelectedRole}
                                    placeholder="Select role"
                                    disabled={scopeMode === "agents"}
                                />
                                {scopeMode === "agents" && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Role is ignored for agents-scoped keys.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label className="text-sm font-medium">Scope</Label>
                            <RadioGroup
                                value={scopeMode}
                                onValueChange={(v) => setScopeMode(v as "admin" | "agents")}
                                className="flex gap-6"
                            >
                                <div className="flex items-center gap-2">
                                    <RadioGroupItem value="admin" id="scope-admin" />
                                    <Label htmlFor="scope-admin" className="font-normal cursor-pointer">
                                        Admin (full access)
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <RadioGroupItem value="agents" id="scope-agents" />
                                    <Label htmlFor="scope-agents" className="font-normal cursor-pointer">
                                        Agents (allowlist, read-only)
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {scopeMode === "agents" && (
                            <div className="flex flex-col gap-2">
                                <Label className="text-sm font-medium">Allowed agents</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                    {selectedAgentIds.map((id) => {
                                        const a = agentList.find((x) => x.id === id)
                                        return (
                                            <Badge
                                                key={id}
                                                variant="secondary"
                                                className="gap-1 pl-2 pr-1 py-1"
                                            >
                                                {a?.name ?? id}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedAgentIds(
                                                            selectedAgentIds.filter((x) => x !== id)
                                                        )
                                                    }
                                                    aria-label={`Remove ${a?.name ?? id}`}
                                                    className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        )
                                    })}
                                    <Select
                                        value=""
                                        onValueChange={(v) => {
                                            if (v && !selectedAgentIds.includes(v)) {
                                                setSelectedAgentIds([...selectedAgentIds, v])
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="w-56 h-8">
                                            <SelectValue placeholder="+ Add agent" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {agentList
                                                .filter((a) => !selectedAgentIds.includes(a.id))
                                                .map((a) => (
                                                    <SelectItem key={a.id} value={a.id}>
                                                        {a.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        <Button
                            onClick={generateApiKey}
                            disabled={
                                isGenerating ||
                                !newKeyName.trim() ||
                                (scopeMode === "agents" && selectedAgentIds.length === 0)
                            }
                            className="whitespace-nowrap self-start"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Generate API Key
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Newly generated key alert */}
            {newlyGeneratedKey && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-900">
                    <Key className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertTitle className="text-green-600 dark:text-green-400">New API Key Generated</AlertTitle>
                    <AlertDescription className="mt-4">
                        <div className="mb-2 text-sm text-muted-foreground">
                            <strong>Important:</strong> This key will only be displayed once. Please copy it now and store it
                            securely.
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <code className="relative rounded bg-muted px-[0.5rem] py-[0.3rem] font-mono text-sm font-semibold overflow-x-auto max-w-[calc(100%-40px)]">
                                {newlyGeneratedKey.key}
                            </code>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => copyToClipboard(newlyGeneratedKey.key)}
                                className="h-8 w-8 flex-shrink-0"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button
                            variant="link"
                            className="mt-2 h-auto p-0 text-green-600 dark:text-green-400"
                            onClick={() => setNewlyGeneratedKey(null)}
                        >
                            Dismiss
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* API keys list */}
            <Card>
                <CardHeader>
                    <CardTitle>Your API Keys</CardTitle>
                    <CardDescription>
                        Manage your existing API keys. For security, API keys are never displayed in full after creation.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {data?.usersPagination?.items?.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                            No API keys found. Generate your first key above.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Key</TableHead>
                                        <TableHead>Scope</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Last Used</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data?.usersPagination?.items?.map((user: any) => {
                                        const isAgentsScoped = user.scope_mode === "agents"
                                        const scopedAgentIds: string[] = Array.isArray(user.agent_ids)
                                            ? user.agent_ids
                                            : []
                                        const scopedNames = scopedAgentIds
                                            .map((id) => agentList.find((a) => a.id === id)?.name ?? id)
                                            .join(", ")
                                        return (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium">{user.name || user.firstname}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-muted px-1 py-0.5 rounded text-xs">****************</code>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {isAgentsScoped ? (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge variant="secondary" className="cursor-help">
                                                                    agents ({scopedAgentIds.length})
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {scopedNames || "no agents"}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ) : (
                                                    <Badge>admin</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="w-48">
                                                    <RoleSelector
                                                        value={user.role}
                                                        onChange={(roleId) => updateApiKeyRole(user.id, roleId)}
                                                        placeholder={isAgentsScoped ? "Not used" : "No role assigned"}
                                                        disabled={isAgentsScoped}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell>{format(new Date(user.createdAt), "PP hh:mm")}</TableCell>
                                            <TableCell>
                                                {user.last_used ? (format(new Date(user.last_used), "PP hh:mm")) : (
                                                    <Badge variant="outline" className="text-xs">
                                                        Never
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Dialog
                                                    open={deleteKeyId === user.id}
                                                    onOpenChange={(open) => {
                                                        if (!open) setDeleteKeyId(null)
                                                        if (open) setDeleteKeyId(user.id)
                                                    }}>
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Delete API Key</DialogTitle>
                                                            <DialogDescription>
                                                                Are you sure you want to delete the API key "{user.name || user.firstname}"? This action cannot be
                                                                undone.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <DialogFooter>
                                                            <Button variant="outline" onClick={() => setDeleteKeyId(null)}>
                                                                Cancel
                                                            </Button>
                                                            <Button variant="destructive" onClick={() => deleteApiKey(user.id)}>
                                                                Delete API Key
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </TableCell>
                                        </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground border-t pt-4">
                    API keys grant full access to your account. Keep them secure and rotate them regularly.
                </CardFooter>
            </Card>
        </div>
    )
}
