"use client"

import { useState, useEffect } from "react"
import { Loader2, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Team } from "@/types/models/team"

interface TeamFormProps {
    initialData?: Team | null
    onSubmit: (teamData: { name: string; description: string | null }) => Promise<void>
    loading: boolean
    onCancel: () => void
}

export function TeamForm({ initialData, onSubmit, loading, onCancel }: TeamFormProps) {
    const [name, setName] = useState(initialData?.name || "")
    const [description, setDescription] = useState(initialData?.description || "")

    useEffect(() => {
        if (initialData) {
            setName(initialData.name)
            setDescription(initialData.description || "")
        }
    }, [initialData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim()) {
            return
        }

        await onSubmit({
            name: name.trim(),
            description: description.trim() || null,
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                    id="teamName"
                    placeholder="e.g. Engineering, HR, Marketing"
                    disabled={loading}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="teamDescription">Description</Label>
                <Textarea
                    id="teamDescription"
                    placeholder="Optional description for this team"
                    disabled={loading}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                />
            </div>

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
                            <Building2 className="mr-2 h-4 w-4" />
                            {initialData ? "Update Team" : "Create Team"}
                        </>
                    )}
                </Button>
            </div>
        </form>
    )
}
