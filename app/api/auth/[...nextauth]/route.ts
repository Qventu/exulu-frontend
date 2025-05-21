import NextAuth from "next-auth";
import {getAuthOptions} from "@/app/api/auth/[...nextauth]/options";

export const dynamic = "force-dynamic";

async function handler(request: any, response: any) {
  const authOptions = await getAuthOptions();
  return await NextAuth(request, response, authOptions);
}

export { handler as GET, handler as POST };
