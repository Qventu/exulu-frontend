import DashboardComponent from "./components/dashboard";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {

    const user = await serverSideAuthCheck();
    if (!user || !user?.super_admin) return redirect(`/chat`);

    return <DashboardComponent />
}
