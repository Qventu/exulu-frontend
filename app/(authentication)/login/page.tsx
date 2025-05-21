import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import * as React from "react";
import Login from "@/app/(authentication)/login/login";
import {getAuthOptions} from "@/app/api/auth/[...nextauth]/options";

export const dynamic = "force-dynamic";

async function authenticationPrecheck(): Promise<void> {
  const authOptions = await getAuthOptions();
  const session: any = await getServerSession(authOptions);
  if (session?.user) return redirect("/dashboard");
}
export default async function Dashboard() {
  await authenticationPrecheck();
  return <Login />;
}
