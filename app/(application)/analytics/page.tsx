import DashboardComponent from "./components/dashboard";
import { guardRoute } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {

    // Route guard for /analytics — gate from nav-config ("analytics"): SA
    // only (navigation.md §1.2/§1.3 rule 5). Replaces the old ad-hoc
    // serverSideAuthCheck + silent redirect("/chat") with the shared
    // predicate + AccessDenied (trust through transparency); unauthenticated
    // hits still redirect to /login inside the guard.
    const denied = await guardRoute("analytics");
    if (denied) return denied;

    return <DashboardComponent />
}
