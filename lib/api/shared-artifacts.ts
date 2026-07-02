import { request } from "@/lib/api/client";

export type ShareAuthMode = "public" | "password" | "regular";

export interface ShareRbac {
  users: { id: number; rights: "read" | "write" }[];
  roles: { id: string; rights: "read" | "write" }[];
  teams: { id: string; rights: "read" | "write" }[];
}

export interface CreateShareInput {
  s3key: string;
  name: string;
  auth_mode: ShareAuthMode;
  expires_at: string | null;
  password?: string;
  content_type?: string | null;
  rights_mode?: string;
  rbac?: ShareRbac;
}

export interface ExistingShare {
  name: string;
  auth_mode: ShareAuthMode;
  expires_at: string | null;
  rights_mode: string | null;
}

export const sharedArtifactsApi = {
  /** Create a share link. Throws the backend `detail` message on failure (e.g. 409). */
  create: (input: CreateShareInput): Promise<{ name: string }> =>
    request("/shared-artifacts", "POST", input),

  /** List all shares for a given s3key created by the caller. Returns [] on error. */
  listByS3Key: async (s3key: string): Promise<ExistingShare[]> => {
    try {
      return (await request(
        `/shared-artifacts?s3key=${encodeURIComponent(s3key)}`,
        "GET",
      )) as ExistingShare[];
    } catch {
      return [];
    }
  },

  /** Delete a share by name. Throws on failure. */
  deleteByName: (name: string): Promise<null> =>
    request(`/shared-artifacts/${encodeURIComponent(name)}`, "DELETE"),
};
