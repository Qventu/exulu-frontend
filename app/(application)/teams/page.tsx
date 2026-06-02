"use client"

import { useState } from "react"
import { Plus, Trash2, Edit, Building2, Loader2, ArrowLeft } from "lucide-react"
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
import { toast } from "@/components/ui/use-toast"
import { useMutation, useQuery } from "@apollo/client"
import { GET_TEAMS, CREATE_TEAM, UPDATE_TEAM_BY_ID, REMOVE_TEAM_BY_ID } from "@/queries/queries"
import { TeamForm } from "@/components/team-form"
import { Team } from "@/types/models/team"

export default function TeamManagement() {
    const [searchTerm, setSearchTerm] = useState("")
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)

    const { loading, data } = useQuery(GET_TEAMS, {
        variables: { page: 1, limit: 100 },
        fetchPolicy: "cache-first",
        nextFetchPolicy: "network-only",
    })

    const [createTeam, { loading: createLoading }] = useMutation(CREATE_TEAM, {
        refetchQueries: [GET_TEAMS, "GetTeams"],
    })

    const [updateTeam, { loading: updateLoading }] = useMutation(UPDATE_TEAM_BY_ID, {
        refetchQueries: [GET_TEAMS, "GetTeams"],
    })

    const [deleteTeam, { loading: deleteLoading }] = useMutation(REMOVE_TEAM_BY_ID, {
        refetchQueries: [GET_TEAMS, "GetTeams"],
    })

    const teams: Team[] = data?.teamsPagination?.items || []
    const filteredTeams = teams.filter(team =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleCreateTeam = async (teamData: { name: string; description: string | null }) => {
        try {
            await createTeam({
                variables: {
                    name: teamData.name,
                    description: teamData.description,
                }
            })
            setCreateDialogOpen(false)
            toast({
                title: "Success",
                description: "Team created successfully",
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to create team",
                variant: "destructive",
            })
        }
    }

    const handleUpdateTeam = async (teamData: { name: string; description: string | null }) => {
        if (!selectedTeam) return

        try {
            await updateTeam({
                variables: {
                    id: selectedTeam.id,
                    name: teamData.name,
                    description: teamData.description,
                }
            })
            setEditDialogOpen(false)
            setSelectedTeam(null)
            toast({
                title: "Success",
                description: "Team updated successfully",
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update team",
                variant: "destructive",
            })
        }
    }

    const handleDeleteTeam = async () => {
        if (!selectedTeam) return

        try {
            await deleteTeam({
                variables: { id: selectedTeam.id }
            })
            setDeleteDialogOpen(false)
            setSelectedTeam(null)
            toast({
                title: "Success",
                description: "Team deleted successfully",
            })
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete team",
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
                <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
                <p className="text-muted-foreground">
                    Create and manage teams. Teams are used to group users (e.g. engineering, hr, marketing) for cost attribution and sharing.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Teams</CardTitle>
                    <CardDescription>
                        Manage teams and their members
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <Input
                            placeholder="Search teams..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 max-w-md"
                        />
                        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Team
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Create New Team</DialogTitle>
                                    <DialogDescription>
                                        Define a team name and optional description.
                                    </DialogDescription>
                                </DialogHeader>
                                <TeamForm
                                    onSubmit={handleCreateTeam}
                                    loading={createLoading}
                                    onCancel={() => setCreateDialogOpen(false)}
                                />
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="text-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                            <p className="text-muted-foreground">Loading teams...</p>
                        </div>
                    ) : filteredTeams.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {searchTerm ? "No teams found matching your search." : "No teams created yet. Create your first team above."}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Team Name</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Updated</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTeams.map((team) => (
                                        <TableRow key={team.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">{team.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                                                {team.description || "—"}
                                            </TableCell>
                                            <TableCell>
                                                {team.createdAt && format(new Date(team.createdAt), "PP hh:mm")}
                                            </TableCell>
                                            <TableCell>
                                                {team.updatedAt && format(new Date(team.updatedAt), "PP hh:mm")}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Dialog open={editDialogOpen && selectedTeam?.id === team.id} onOpenChange={(open) => {
                                                        setEditDialogOpen(open)
                                                        if (!open) setSelectedTeam(null)
                                                    }}>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setSelectedTeam(team)}
                                                                className="h-8 w-8"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                                            <DialogHeader>
                                                                <DialogTitle>Edit Team</DialogTitle>
                                                                <DialogDescription>
                                                                    Update the team name and description.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <TeamForm
                                                                initialData={selectedTeam}
                                                                onSubmit={handleUpdateTeam}
                                                                loading={updateLoading}
                                                                onCancel={() => {
                                                                    setEditDialogOpen(false)
                                                                    setSelectedTeam(null)
                                                                }}
                                                            />
                                                        </DialogContent>
                                                    </Dialog>

                                                    <Dialog open={deleteDialogOpen && selectedTeam?.id === team.id} onOpenChange={(open) => {
                                                        setDeleteDialogOpen(open)
                                                        if (!open) setSelectedTeam(null)
                                                    }}>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setSelectedTeam(team)}
                                                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Delete Team</DialogTitle>
                                                                <DialogDescription>
                                                                    Are you sure you want to delete the team "{selectedTeam?.name}"? This action cannot be undone.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <DialogFooter>
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        setDeleteDialogOpen(false)
                                                                        setSelectedTeam(null)
                                                                    }}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                                <Button
                                                                    variant="destructive"
                                                                    onClick={handleDeleteTeam}
                                                                    disabled={deleteLoading}
                                                                >
                                                                    {deleteLoading ? (
                                                                        <>
                                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                            Deleting...
                                                                        </>
                                                                    ) : (
                                                                        "Delete Team"
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
