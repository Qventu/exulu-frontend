import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// A route that provides information regarding the 
// application configuration. Used by the Claude Code
// CLI for providing the correct backend url.
export async function GET(request: Request) {
    
    if (!process.env.BACKEND) {
        throw new Error("BACKEND is not set");
    }

    const feedbackEnabled =
        process.env.FEEDBACK_ENABLED === "true" &&
        !!process.env.FEEDBACK_BACKEND &&
        !!process.env.FEEDBACK_TOKEN;

    return NextResponse.json({
        backend: process.env.BACKEND,
        google_client_id: process.env.GOOGLE_CLIENT_ID,
        auth_mode: process.env.AUTH_MODE,
        langfuse: process.env.LANGFUSE_URI,
        // FEEDBACK_TOKEN is deliberately NOT included: this endpoint is
        // unauthenticated and the token is a server-only secret (the
        // /api/feedback/[kind] proxy injects it server-side).
        feedback: feedbackEnabled
            ? {
                enabled: true as const,
                backend: process.env.FEEDBACK_BACKEND!,
                agentSlug: process.env.FEEDBACK_AGENT_SLUG ?? "/agent",
                bugAgentId:
                    process.env.FEEDBACK_AGENT_BUG_ID ??
                    "5d8ef50c-15dc-490a-8b35-4c4a57961dc5",
                featureAgentId:
                    process.env.FEEDBACK_AGENT_FEATURE_ID ??
                    "e64b11be-0b0a-464e-a8e1-4532b5ed8413",
            }
            : undefined,
    }, {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
    });
}
