"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setGuestPassword } from "./actions";

export function GuestPasswordGate({ id, error }: { id: string; error?: boolean }) {
  const t = useTranslations("publicAgents.passwordGate");
  const [pw, setPw] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <form
        className="w-full max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => setGuestPassword(id, pw));
        }}
      >
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        {error && <p className="text-sm text-destructive">{t("error")}</p>}
        <Input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={t("placeholder")}
          autoFocus
        />
        <Button type="submit" disabled={pending || !pw} className="w-full">
          {pending ? t("checking") : t("submit")}
        </Button>
      </form>
    </div>
  );
}
