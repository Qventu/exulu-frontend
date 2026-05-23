"use client";

import { ModelForm } from "../components/model-form";

export const dynamic = "force-dynamic";

export default function CreateModelPage() {
  return (
    <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Add Model</h2>
        <p className="text-muted-foreground">
          Create a new model by selecting a provider and an encrypted
          authentication variable.
        </p>
      </div>
      <ModelForm />
    </div>
  );
}
