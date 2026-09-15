import { notFound } from "next/navigation";

import { StepPanel } from "@/components/demo/step-panel";
import { DEMO_SCENES } from "@/lib/demo/scenes";
import { isDemoMode } from "@/lib/demo/flag";

export default async function ScenePage({ params }: { params: Promise<{ id: string }> }) {
  if (!isDemoMode()) notFound();
  const { id } = await params;
  const scene = DEMO_SCENES[id];
  if (!scene) notFound();

  // No heading here. The step's title is already on screen, as the docked
  // panel's <h2> right beside this column (components/demo/tour-panel.tsx
  // renders it for all 37 steps), and this page used to repeat the identical
  // sentence as an <h1> from a second copy in lib/demo/scenes.ts. The panel's
  // is the one that stays: it is the tour's own chrome, it is what every
  // other step shows, and for these four steps — which carry no `content` of
  // their own — dropping it would leave the panel holding nothing but a
  // chapter counter and two buttons.
  return (
    <div className="flex min-h-0 grow items-center justify-center overflow-y-auto p-8">
      <div className="demo-scene w-full max-w-3xl">
        <StepPanel content={scene.content} />
      </div>
    </div>
  );
}
