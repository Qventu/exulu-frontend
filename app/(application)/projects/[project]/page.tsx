"use client";

/**
 * /projects/[project] — thin route shell; the surface lives in
 * components/project-detail-view.tsx (projects.md §4). Suspense boundary for
 * the view's useSearchParams (URL-backed ?tab=) during prerender.
 */

import { useParams } from "next/navigation";
import * as React from "react";

import { ProjectDetailView } from "../components/project-detail-view";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params?.project as string;

  return (
    <React.Suspense fallback={null}>
      <ProjectDetailView projectId={projectId} />
    </React.Suspense>
  );
}
