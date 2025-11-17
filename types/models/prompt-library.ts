import { ExuluRightsMode } from "./agent-session";

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
    projects?: Array<{ id: string; rights: "read" | "write" }>;
  };
  created_by: string;
  createdAt: string;
  updatedAt: string;
  usage_count: number;
  favorite_count: number;
  assigned_agents?: string[];
  is_favorited?: boolean; // Computed per user on frontend
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
    projects?: Array<{ id: string; rights: "read" | "write" }>;
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
    projects?: Array<{ id: string; rights: "read" | "write" }>;
  };
  assigned_agents?: string[];
}

export type PromptSortBy =
  | "MOST_FAVORITED"
  | "MOST_USED"
  | "RECENTLY_CREATED"
  | "RECENTLY_UPDATED"
  | "ALPHABETICAL";
