/**
 * /roles — alias of the canonical Users-&-access surface (access.md §3).
 * Server-redirects to /users?tab=roles. The route exists so existing nav
 * aliases (nav-config: `aliases: ["/roles", "/teams"]`) and external deep
 * links keep working. The route guard lives in layout.tsx.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function RolesPage() {
  redirect("/users?tab=roles");
}
