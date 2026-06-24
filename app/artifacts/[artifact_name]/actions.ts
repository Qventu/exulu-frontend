"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function setSharePassword(name: string, password: string) {
  (await cookies()).set(`share_pw_${name}`, password, {
    httpOnly: true,
    sameSite: "lax",
    path: `/artifacts/${name}`,
  });
  redirect(`/artifacts/${encodeURIComponent(name)}`);
}
