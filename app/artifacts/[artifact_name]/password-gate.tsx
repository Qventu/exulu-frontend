"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setSharePassword } from "./actions";

export function PasswordGate({ name, error }: { name: string; error?: boolean }) {
  const [pw, setPw] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <form
        className="w-full max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => setSharePassword(name, pw));
        }}
      >
        <h1 className="text-lg font-semibold">This artifact is password protected</h1>
        {error && <p className="text-sm text-destructive">Incorrect password. Try again.</p>}
        <Input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          autoFocus
        />
        <Button type="submit" disabled={pending || !pw} className="w-full">
          {pending ? "Checking…" : "View artifact"}
        </Button>
      </form>
    </div>
  );
}
