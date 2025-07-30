import { NextResponse } from "next/server";

// A route that provides information regarding the 
// application configuration. Used by the Claude Code
// CLI for providing the correct backend url.
export async function GET(request: Request) {
    return NextResponse.json({
        backend: process.env.NEXT_PUBLIC_BACKEND,
    }, {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
    });
}
