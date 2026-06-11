"use client";

import AgentVisual from "./lottie";
import React, { useState } from "react";
import { Agent } from "@/types/models/agent";
import { toast } from "sonner";
import { CREATE_AGENT_SESSION, GET_AGENTS } from "@/queries/queries";
import { useQuery, useMutation } from "@apollo/client";
import { Search, Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export const AgentSelectionModalContentWrapper = () => {
    const router = useRouter();
    return <AgentSelectionModalContent onSelect={({ session, agent }) => {
        router.push(`/chat/${agent}/${session}`);
    }} project={undefined} />
}

export const AgentSelectionModalContent = ({
    onSelect,
    project
}: {
    onSelect: ({
        session,
        agent
    }: {
        session: string;
        agent: string;
    }) => void;
    project?: string;
}) => {
    const t = useTranslations();
    const { data: agentsData, loading: agentsLoading } = useQuery(GET_AGENTS, {
        variables: {
            page: 1,
            limit: 100,
            filters: [],
            sort: { field: "updatedAt", direction: "DESC" }
        }
    });
    const agents: Agent[] = agentsData?.agentsPagination?.items || [];
    const [createAgentSession] = useMutation(CREATE_AGENT_SESSION);
    const [agentSearch, setAgentSearch] = useState("");

    const handleAgentSelect = async (agent: Agent) => {
        try {
            const result = await createAgentSession({
                variables: {
                    title: t('agentSelection.newSession', { agentName: agent.name }),
                    agent: agent.id,
                    project: project,
                    rights_mode: "private",
                    /* RBAC: {
                      projects: [{ id: project.id, rights: "read" }]
                    } */
                },
            });

            const sessionId = result.data?.agent_sessionsCreateOne?.item?.id;

            if (sessionId) {
                toast.success(t('common.success'), { description: t('agentSelection.sessionCreated') });

                setAgentSearch("");

                onSelect({
                    session: sessionId,
                    agent: agent.id
                });

            }
        } catch (error: any) {
            console.error("Error creating session:", error);
            toast.error(t('common.error'), { description: error.message || t('agentSelection.sessionError') });
        }
    };

    const filteredAgents = React.useMemo(() => {
        if (!agentSearch) return agents;
        return agents.filter(agent =>
            agent.name.toLowerCase().includes(agentSearch.toLowerCase())
        );
    }, [agents, agentSearch]);

    return (
        <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={t('agentSelection.searchPlaceholder')}
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Agents Grid */}
            <div className="max-h-96 overflow-y-auto">
                {agentsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="p-4 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-12 w-12 rounded-full" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredAgents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredAgents.map((agent) => (
                            <div
                                key={agent.id}
                                className="p-4 border rounded-lg hover:border-primary cursor-pointer transition-colors"
                                onClick={() => handleAgentSelect(agent)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <AgentVisual agent={agent} status="ready" className="w-12 h-12" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{agent.name}</p>
                                        {/* Badge showing the modelName */}
                                        <Badge variant="secondary" className="text-xs">
                                            {agent.modelName}
                                        </Badge>
                                        <p className="text-sm text-muted-foreground">
                                            {(agent.description || agent.type || "")} {agent.modelName && `(${agent.modelName})`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>{agentSearch ? t('agentSelection.noAgentsFound') : t('agentSelection.noAgentsAvailable')}</p>
                    </div>
                )}
            </div>
        </div>
    )
}