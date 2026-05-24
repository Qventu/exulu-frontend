"use client";

import { use, useContext } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { ModelForm } from "../../components/model-form";
import { Button } from "@/components/ui/button";
import { ConfigContext } from "@/components/config-context";

export const dynamic = "force-dynamic";

export default function EditModelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const configContext = useContext(ConfigContext);
  const litellmEnabled = configContext?.liteLLM?.enabled === true;

  if (litellmEnabled) {
    return (
      <div className="hidden h-full flex-1 flex-col space-y-4 p-8 md:flex">
        <h2 className="text-2xl font-bold tracking-tight">Edit Model</h2>
        <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4 text-sm max-w-2xl">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1">
            <p className="font-medium">Not available in LiteLLM mode</p>
            <p className="text-muted-foreground">
              When LiteLLM is enabled, models are configured directly in
              LiteLLM's <code>config.yaml</code>. Edit it on the host and restart
              Exulu to pick up changes.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/models">Back to models</Link>
        </Button>
      </div>
    );
  }

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
