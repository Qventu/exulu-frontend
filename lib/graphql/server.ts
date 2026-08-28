import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";
import { getCurrentPosition } from "@/lib/demo/current-position";
import { getWorld } from "@/lib/demo/fixtures";
import { isDemoMode } from "@/lib/demo/flag";
import { operationNameOf, resolverFor } from "@/lib/demo/resolvers";

export async function fetchGraphQLServerSide(query: string, variables: any) {
    // Demo mode serves fixtures instead of calling a backend, exactly as the
    // client-side demo Apollo link does — same resolver table, same operation
    // names. This is a DATA source switch, not an auth bypass: the auth
    // decision stays in lib/route-guard.tsx.
    //
    // It belongs here rather than in per-route demo pages. Detail routes
    // (agents/edit/[id], chat/[agent]/*, workflows/[id], prompts/[id],
    // data/[ctx]) all fetch through this function, so one branch lets every one
    // of them run on its real product route. The alternative — a parallel
    // /demo/* page per detail route — meant a second copy of every detail
    // screen, which would drift from the original and defeat the point of
    // rendering the real product.
    if (isDemoMode()) {
      const operationName = operationNameOf(query);
      const resolver = resolverFor(operationName);
      if (!resolver) {
        console.warn(
          `[demo] unmapped server-side GraphQL operation: ${operationName ?? "<unnamed>"}`,
        );
        return {};
      }
      return resolver(getWorld(getCurrentPosition()), variables ?? {});
    }

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