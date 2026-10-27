import {
  AppWindow,
  File,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Presentation,
  type LucideIcon,
} from "lucide-react";

import type { ArtifactKind } from "@/lib/artifacts/artifact-type";

/** One icon per artifact kind — the table's type cell, the favourite cards and their previews. */
export const KIND_ICON: Record<ArtifactKind, LucideIcon> = {
  app: AppWindow,
  pdf: FileText,
  slides: Presentation,
  sheet: FileSpreadsheet,
  document: FileText,
  image: ImageIcon,
  text: FileText,
  data: File,
  file: File,
};
