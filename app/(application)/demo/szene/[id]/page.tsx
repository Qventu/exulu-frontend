import { notFound } from "next/navigation";

import { StepPanel } from "@/components/demo/step-panel";
import { DEMO_SCENES } from "@/lib/demo/scenes";
import { isDemoMode } from "@/lib/demo/flag";

export default async function ScenePage({ params }: { params: Promise<{ id: string }> }) {
  if (!isDemoMode()) notFound();
  const { id } = await params;
  const scene = DEMO_SCENES[id];
  if (!scene) notFound();

  return (
    <div className="flex min-h-0 grow items-center justify-center overflow-y-auto p-8">
      <div className="demo-scene w-full max-w-3xl">
        <h1 className="mb-6 text-3xl font-semibold">{scene.title}</h1>
        <StepPanel step={{ id, route: "", anchor: null, title: scene.title, content: scene.content }} />
      </div>
    </div>
  );
}
