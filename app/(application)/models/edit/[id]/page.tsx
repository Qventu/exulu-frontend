"use client";

import { use } from "react";
import { ModelForm } from "../../components/model-form";

export const dynamic = "force-dynamic";

export default function EditModelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Edit Model</h2>
        <p className="text-muted-foreground">Update the model configuration.</p>
      </div>
      <ModelForm modelId={id} />
    </div>
  );
}
