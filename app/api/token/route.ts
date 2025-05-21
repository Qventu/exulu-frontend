import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(req, res) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, raw: true });
    if (!token) {
        throw new Error("Unauthorized");
    }
    return NextResponse.json({ token });
}
