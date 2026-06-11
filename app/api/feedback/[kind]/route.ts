import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";

export const dynamic = "force-dynamic";

// Server-side proxy for the in-app feedback chat. The browser calls
// /api/feedback/{bug|feature}; this handler resolves the feedback agent
// (slug/id) from env, injects the FEEDBACK_TOKEN secret server-side and
// streams the agent response back. The token never reaches the client.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ kind: string }> },
) {
    const { kind } = await params;
    if (kind !== "bug" && kind !== "feature") {
        return NextResponse.json({ message: "Unknown feedback kind" }, { status: 404 });
    }

    const authOptions = await getAuthOptions();
    const session: any = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const backend = process.env.FEEDBACK_BACKEND;
    const token = process.env.FEEDBACK_TOKEN;
    const agentSlug = kind === "bug"
        ? process.env.BUG_AGENT_SLUG
        : process.env.FEATURE_AGENT_SLUG;
    const agentId = kind === "bug"
        ? process.env.BUG_AGENT_ID
        : process.env.FEATURE_AGENT_ID;

    if (process.env.FEEDBACK_ENABLED !== "true" || !backend || !token || !agentSlug || !agentId) {
        return NextResponse.json({ message: "Feedback is not configured" }, { status: 503 });
    }

    const upstream = await fetch(`${backend}/agents/${agentSlug}/run/${agentId}`, {
        method: "POST",
        body: await request.text(),
        headers: {
            "Content-Type": "application/json",
            "exulu-api-key": token,
            User: request.headers.get("User") ?? "anonymous",
            Session: request.headers.get("Session") ?? "",
            Stream: request.headers.get("Stream") ?? "true",
        },
    });

    // Pass the agent response through unbuffered so streaming chat keeps working.
    const headers = new Headers();
    const contentType = upstream.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);
    const uiMessageStream = upstream.headers.get("x-vercel-ai-ui-message-stream");
    if (uiMessageStream) headers.set("x-vercel-ai-ui-message-stream", uiMessageStream);

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
    });
}
