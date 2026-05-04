import { ExuluRightsMode } from "./agent-session";

export interface SkillVersion {
  version: number;
  created_at: string;
  label?: string;
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  s3folder?: string;
  tags?: string[];
  usage_count: number;
  favorite_count: number;
  current_version: number;
  history?: SkillVersion[];
  rights_mode: ExuluRightsMode;
  created_by: string;
  createdAt: string;
  updatedAt: string;
  RBAC?: {
    type?: string;
    users?: Array<{ id: number; rights: "read" | "write" }>;
    roles?: Array<{ id: string; rights: "read" | "write" }>;
  };
}

export interface CreateSkillInput {
  name: string;
  description?: string;
  tags?: string[];
  rights_mode: ExuluRightsMode;
  RBAC?: {
    users?: Array<{ id: number; rights: "read" | "write" }>;
    roles?: Array<{ id: string; rights: "read" | "write" }>;
  };
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  tags?: string[];
  rights_mode?: ExuluRightsMode;
  RBAC?: {
    users?: Array<{ id: number; rights: "read" | "write" }>;
    roles?: Array<{ id: string; rights: "read" | "write" }>;
  };
}

// File tree types returned by GET /skills/:id/files
export interface SkillFileNode {
  name: string;
  path: string;
  key: string;
  type: "file" | "folder";
  size?: number;
  lastModified?: string;
  children?: SkillFileNode[];
}

export interface SkillFilesResponse {
  version: number;
  tree: SkillFileNode;
  fileCount: number;
}

export interface SkillFileDiff {
  path: string;
  status: "added" | "removed" | "modified" | "unchanged";
  diff?: string;
}

export interface SkillDiffResponse {
  fromVersion: number;
  toVersion: number;
  files: SkillFileDiff[];
}
