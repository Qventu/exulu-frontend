import { cache } from "react";
import { getServerSession } from "next-auth";
import { getAuthOptions, pool } from "@/app/api/auth/[...nextauth]/options";
import { UserBudgetView, UserWithRole } from "@/types/models/user";

/**
 * Server-to-server fetch of the caller's own budget from the backend's
 * /me/budget endpoint. The backend holds the LiteLLM master key and gates this
 * on the "show user budget in chat" setting (returning null otherwise), so all
 * LiteLLM logic stays in the backend. Never throws — budget is best-effort.
 */
const fetchUserBudget = async (
  token: string | undefined,
): Promise<UserBudgetView | null> => {
  try {
    const backend = process.env.BACKEND;
    if (!backend || !token) return null;
    const res = await fetch(`${backend}/me/budget`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.budget ?? null;
  } catch {
    return null;
  }
};

/**
 * Wrapped in React.cache (per-request memo): the (application) layout, the
 * Home page and every route guard (lib/route-guard.tsx) in the same render
 * pass share ONE users+roles query and /me/budget fetch instead of repeating
 * the round-trips per caller.
 */
export const serverSideAuthCheck = cache(
  async (): Promise<UserWithRole | false> => {
    const authOptions = await getAuthOptions();
    const session: any = await getServerSession(authOptions);
    if (!session?.user) return false;

    const client = await pool.connect();
    try {
      const res = await client.query(
        `
          SELECT
            users.*,
            json_build_object(
              'id', roles.id,
              'name', roles.name,
              'agents', roles.agents,
              'workflows', roles.workflows,
              'variables', roles.variables,
              'users', roles.users,
              'api', roles.api,
              'evals', roles.evals,
              'budget_management', roles.budget_management
            ) as role
          FROM users
          LEFT JOIN roles ON users.role = roles.id
          WHERE users.email = $1
        `,
        [session.user.email],
      );
      const user: any = res.rows[0];
      if (!user) {
        return false;
      }

      // Attach the live budget snapshot for the in-chat indicator. The backend
      // gates this on the "show user budget in chat" setting and returns null
      // otherwise; it's backed by a short cache so this stays cheap across the
      // server-side navigations that re-run this check.
      user.budget = await fetchUserBudget(session.user.jwt);

      return user;
    } finally {
      client.release();
    }
  },
);
