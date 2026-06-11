import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";

export async function fetchGraphQLServerSide(query: string, variables: any) {
    const authOptions = await getAuthOptions();
    const session: any = await getServerSession(authOptions);
  
    if (!session?.user?.jwt) {
      throw new Error("No authentication token available");
    }
  
    const backend = process.env.BACKEND;
    if (!backend) {
      throw new Error("No backend configured");
    }
  
    const response = await fetch(`${backend}/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.user.jwt}`,
        "Accept": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      cache: "no-store",
    });
  
    const result = await response.json();
  
    if (result.errors) {
      throw new Error(result.errors[0]?.message || "GraphQL error");
    }
  
    return result.data;
  }