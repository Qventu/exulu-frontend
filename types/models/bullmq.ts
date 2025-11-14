import { UIMessage } from "ai"

export type BullMqJobData = {
    label: string,
    type: string,
    inputs: any,
    timeoutInSeconds: number,
    user?: number,
    role?: string,
    trigger: "tool" | "agent" | "flow" | "api" | "claude-code" | "user",
    messages?: UIMessage[],
    eval_run_id?: string,
    eval_run_name?: string,
    test_case_id?: string,
    test_case_name?: string,
    eval_functions?: {
        id: string
        config: Record<string, any>
    }[],
    agent_id?: string,
    expected_output?: string,
    expected_tools?: string[],
    expected_knowledge_sources?: string[],
    expected_agent_tools?: string[],
    config?: Record<string, any>,
    scoring_method?: string,
    pass_threshold?: number,
    workflow?: string,
    embedder?: string,
    processor?: string,
    evaluation?: string,
    item?: string,
    context?: string,
    source?: string,
}