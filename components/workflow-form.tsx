"use client"

import type React from "react"
import {useState} from "react"
import {Upload} from "lucide-react"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs"
import {Agent} from "@EXULU_SHARED/models/agent";
import {AgentBackend} from "@EXULU_SHARED/models/agent-backend";
import { dezerialize } from "zodex";
import { ZodFormBuilder } from "./zod-form-builder"

interface AgentFormProps {
    onSubmit: (data: FormData) => Promise<void>
    onBatchSubmit: (file: File) => Promise<void>
    agent: Agent
    backend: AgentBackend
}

export function WorkflowForm({onSubmit, onBatchSubmit, agent, backend}: AgentFormProps) {

    const [isLoading, setIsLoading] = useState(false)

    async function handleSubmit(data: any) {
        setIsLoading(true)
        await onSubmit(data)
        setIsLoading(false)
    }

    async function handleBatchUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files?.[0]) return

        setIsLoading(true)
        await onBatchSubmit(e.target.files[0])
        setIsLoading(false)
    }

    const zodSchema: any = dezerialize(backend.inputSchema);

    return (
        <div className="space-y-4">
            <Tabs defaultValue="single" className="w-full">
                <TabsList>
                    <TabsTrigger value="single">Single Run</TabsTrigger>
                    <TabsTrigger disabled={!backend.enable_batch} value="batch">Batch Upload</TabsTrigger>
                </TabsList>
                <TabsContent value="single">
                    <Card>
                        <CardHeader>
                            <CardTitle>Run Agent</CardTitle>
                            <CardDescription>Submit a single job to the agent for processing
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ZodFormBuilder jsonSchema={backend.inputSchema} zodSchema={zodSchema} onSubmit={handleSubmit}/>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="batch">
                    <Card>
                        <CardHeader>
                            <CardTitle>Batch Upload</CardTitle>
                            <CardDescription>Upload a CSV file with multiple jobs to process</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="csv">CSV File</Label>
                                    <Input id="csv" type="file" accept=".csv" onChange={handleBatchUpload}
                                           disabled={isLoading}/>
                                </div>
                                <div className="rounded-lg border border-dashed p-4">
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <Upload className="h-8 w-8 text-muted-foreground"/>
                                        <p className="text-sm text-muted-foreground">Upload a CSV file with the following
                                            columns:</p>
                                        <p className="text-xs text-muted-foreground">title, content, file_url</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

