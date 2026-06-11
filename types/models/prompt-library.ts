// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

import { ExuluRightsMode } from "./agent-session";

export interface PromptVersion {
  version: number;
  content: string;
  name?: string;
  description?: string;
  tags?: string[];
  timestamp: string;
  changed_by: string;
  change_message?: string;
}

export interface PromptLibrary {
  id: string;
  name: string;
  description?: string;
  content: string;
  tags: string[];
  rights_mode: ExuluRightsMode;
  RBAC?: {
    type?: string;
    users?: Array<{ id: number; rights: "read" | "write" }>;
    roles?: Array<{ id: string; rights: "read" | "write" }>;
    // projects?: Array<{ id: string; rights: "read" | "write" }>;
  };
  created_by: string;
  createdAt: string;
  updatedAt: string;
  usage_count: number;
  favorite_count: number;
  assigned_agents?: string[];
  is_favorited?: boolean; // Computed per user on frontend
  history?: PromptVersion[]; // Version history
}

export interface PromptFavorite {
  id: string;
  user_id: number;
  prompt_id: string;
  createdAt: string;
}

export interface CreatePromptInput {
  name: string;
  description?: string;
  content: string;
  tags?: string[];
  rights_mode: ExuluRightsMode;
  RBAC?: {
    users?: Array<{ id: number; rights: "read" | "write" }>;
    roles?: Array<{ id: string; rights: "read" | "write" }>;
    // projects?: Array<{ id: string; rights: "read" | "write" }>;
  };
  assigned_agents?: string[];
}

export interface UpdatePromptInput {
  name?: string;
  description?: string;
  content?: string;
  tags?: string[];
  rights_mode?: ExuluRightsMode;
  RBAC?: {
    users?: Array<{ id: number; rights: "read" | "write" }>;
    roles?: Array<{ id: string; rights: "read" | "write" }>;
    // projects?: Array<{ id: string; rights: "read" | "write" }>;
  };
  assigned_agents?: string[];
  change_message?: string; // Optional message describing changes
}

export type PromptSortBy =
  | "MOST_FAVORITED"
  | "MOST_USED"
  | "RECENTLY_CREATED"
  | "RECENTLY_UPDATED"
  | "ALPHABETICAL";
