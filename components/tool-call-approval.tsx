import { ChatAddToolApproveResponseFunction, DynamicToolUIPart } from "ai"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { CheckCircle2, XCircleIcon, AlertTriangle, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { Agent } from "@/types/models/agent"

export const ToolCallApproval = ({
    part,
    agent,
    addToolApprovalResponse
}: {
    agent: Agent
    part: DynamicToolUIPart
    addToolApprovalResponse: ChatAddToolApproveResponseFunction
}) => {

    const toolName = (part as { type: string }).type?.replace('tool-', '')?.replace(/_/g, ' ') || 'command'
    const toolId = (part as { type: string }).type;

    if (part.state === 'approval-responded') {

        const isDenied =
            (part.state === "approval-responded" &&
                (part as { approval?: { approved?: boolean } }).approval
                    ?.approved === false);

        if (isDenied) {
            return (
                <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <XCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                            <CardTitle className="text-sm font-medium capitalize text-red-900 dark:text-red-100">
                                Denied: {toolName}.
                            </CardTitle>
                        </div>
                    </CardHeader>
                </Card>
            )
        }

        return (
            <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <CardTitle className="text-sm font-medium capitalize text-green-900 dark:text-green-100">
                            Approved: {toolName}.
                        </CardTitle>
                    </div>
                </CardHeader>
            </Card>
        )
    }

    if (!part.approval?.id) {
        return null
    }

    if (part.state === 'approval-requested') {

        return (
            <Card className="max-w-2xl border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-lg">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Allow tool call
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Run {toolName}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>

                    <div className="flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 p-4 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <CardDescription className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
                            The agent wishes to execute a tool call. Please review the tool call and approve or deny it.
                        </CardDescription>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            size="default"
                            className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => {
                                const path = window.location.pathname;
                                const session = path.split('/').filter(Boolean).pop();
                                if (!session) {
                                    toast.error('No session ID provided.', { description: 'No session ID provided.' });
                                    return;
                                }
                                addToolApprovalResponse({
                                    id: part.approval!.id as string,
                                    approved: true,
                                })
                                // Set local storage with pre-approved tool calls for this chat
                                const preApprovedToolCalls = localStorage.getItem(`pre-approved-tool-calls-${session}`);
                                if (preApprovedToolCalls) {
                                    const preApprovedToolCallsArray = JSON.parse(preApprovedToolCalls);
                                    preApprovedToolCallsArray.push(toolId);
                                    localStorage.setItem(`pre-approved-tool-calls-${session}`, JSON.stringify(preApprovedToolCallsArray));
                                } else {
                                    localStorage.setItem(`pre-approved-tool-calls-${session}`, JSON.stringify([toolId]));
                                }
                            }}
                        >
                            Allow for this chat
                        </Button>
                        <Button
                            variant="outline"
                            size="default"
                            className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => {
                                addToolApprovalResponse({
                                    id: part.approval!.id as string,
                                    approved: true,
                                })
                            }
                            }
                        >
                            Allow once
                        </Button>
                        <Button
                            variant="default"
                            size="default"
                            className="bg-black hover:bg-gray-900 text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black"
                            onClick={() => {
                                addToolApprovalResponse({
                                    id: part.approval!.id as string,
                                    approved: false,
                                })
                            }
                            }
                        >
                            Deny
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }
    return null;
}