"use client"
import { useState } from "react"
import { Copy, Key, Loader2, Plus, Trash2 } from "lucide-react"
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
import bcrypt from "bcryptjs";
import {useMutation, useQuery} from "@apollo/client";
import {CREATE_API_USER, GET_USERS, REMOVE_USER_BY_ID} from "@/queries/queries";
const SALT_ROUNDS = 12;

export async function encryptApiKey(apiKey) {
    const hash = await bcrypt.hash(apiKey, SALT_ROUNDS);
    return hash;
}
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
    const [isGenerating, setIsGenerating] = useState(false)
    const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<ApiKey | null>(null)
    const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null)

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

        const plainKey = `sk_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
        const postFix = `/${newKeyName.toLowerCase().trim().replaceAll(" ", "_")}`
        const encryptedKey = await encryptApiKey(plainKey)
        const response = await createApiUser({
            variables: {
                firstname: `${newKeyName}`,
                type: "api",
                apikey: `${encryptedKey}${postFix}`,
                email: `${encryptedKey}@exulu-api-user.com`
            }
        })

        console.log("response", response)
        setNewlyGeneratedKey({
            id: `${response.data?.usersCreateOne?.id}`,
            name: newKeyName,
            key: `${plainKey}${postFix}`,
            createdAt: new Date()
        })
        setNewKeyName("")
        setIsGenerating(false)

    }

    const [removeApiUser, removeApiUserResult] = useMutation(REMOVE_USER_BY_ID, {
        refetchQueries: [
            GET_USERS, // DocumentNode object parsed with gql
            "GetUsers", // Query name
        ],
    });

    const [ createApiUser, createApiUserResult] = useMutation(CREATE_API_USER, {
        refetchQueries: [
            GET_USERS, // DocumentNode object parsed with gql
            "GetUsers", // Query name
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

    return (
        <div className="container mx-auto py-6 space-y-8 max-w-5xl">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
                <p className="text-muted-foreground">
                    Manage your API keys for accessing the API. Keep your keys secure - they have full access to your account.
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
                    <div className="flex flex-col gap-4 sm:flex-row">
                        <Input
                            placeholder="API Key Name (e.g. Production, Development)"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            className="flex-1"
                        />
                        <Button
                            onClick={generateApiKey}
                            disabled={isGenerating || !newKeyName.trim()}
                            className="whitespace-nowrap"
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
                                        <TableHead>Created</TableHead>
                                        <TableHead>Last Used</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data?.usersPagination?.items?.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium">{user.name || user.firstname}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-muted px-1 py-0.5 rounded text-xs">****************</code>
                                                </div>
                                            </TableCell>
                                            <TableCell>{format(new Date(Number(user.createdAt)), "PP hh:mm")}</TableCell>
                                            <TableCell>
                                                {user.last_used ? (format(new Date(Number(user.last_used)), "PP hh:mm")) : (
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
                                                    }}
                                                >
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
                                    ))}
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
