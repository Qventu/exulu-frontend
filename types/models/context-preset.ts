// Shared shape for context presets, mirroring CONTEXT_PRESET_FIELDS in
// queries/queries.ts. Replaces the per-component interface copies
// (items-selection-modal.tsx; save-preset-modal.tsx kept its local frozen
// copy — this type is structurally assignable to it).

export interface ContextPresetRBACUser {
  id: number;
  rights: "read" | "write";
}

export interface ContextPresetRBACEntry {
  id: string;
  rights: "read" | "write";
}

export interface ContextPreset {
  id: string;
  name: string;
  description?: string;
  /** Global ids: "<contextId>" (whole context) or "<contextId>/<itemId>". */
  preset_items: string[];
  tags?: string[];
  usage_count: number;
  favorite_count?: number;
  rights_mode?: "private" | "users" | "roles" | "teams" | "public";
  created_by: number;
  createdAt?: string;
  updatedAt?: string;
  RBAC?: {
    type?: string;
    users?: ContextPresetRBACUser[];
    roles?: ContextPresetRBACEntry[];
    teams?: ContextPresetRBACEntry[];
  };
}
