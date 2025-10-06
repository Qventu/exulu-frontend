export type UserRole = {
  id: string;
  name: string;
  agents?: "read" | "write" | null;
  workflows?: "read" | "write" | null;
  variables?: "read" | "write" | null;
  users?: "read" | "write" | null;
  api?: "read" | "write" | null;
  evals?: "read" | "write" | null;
  createdAt?: string;
  updatedAt?: string;
};
