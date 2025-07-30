import { redirect } from "next/navigation";
import * as React from "react";
import Login from "@/app/(authentication)/login/login";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";

export const dynamic = "force-dynamic";

async function authenticationPrecheck(): Promise<void> {
  const user = await serverSideAuthCheck();
  if (user) return redirect(`/dashboard`);
}
export default async function Dashboard() {
  await authenticationPrecheck();
  return <Login />;
}
