import { ProjectDetailSkeleton } from "../components/skeletons";

/**
 * Route-level skeleton mirroring the project detail layout (PageShell content
 * variant capped at max-w-4xl: breadcrumb → header with avatar/title/actions
 * → tab bar → session rows). Identical markup to the in-page loading state
 * (components/skeletons.tsx) so the two states don't jump.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-4 md:p-8">
      <ProjectDetailSkeleton />
    </div>
  );
}
