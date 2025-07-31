import { NextResponse } from "next/server";

// A route that provides information regarding the 
// application configuration. Used by the Claude Code
// CLI for providing the correct backend url.
export async function GET(request: Request) {
    
    if (!process.env.BACKEND) {
        throw new Error("BACKEND is not set");
    }

    return NextResponse.json({
        backend: process.env.BACKEND,
        google_client_id: process.env.GOOGLE_CLIENT_ID,
        auth_mode: process.env.AUTH_MODE,
        langfuse: process.env.LANGFUSE_URI,
    }, {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
    });
}
