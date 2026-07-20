"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function setGuestPassword(id: string, password: string) {
  (await cookies()).set(`guest_pw_${id}`, password, {
    httpOnly: true,
    sameSite: "lax",
    path: `/public/agents/${id}`,
  });
  redirect(`/public/agents/${encodeURIComponent(id)}`);
}
