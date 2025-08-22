export type User = {
  id: string;
  email: string;
  emailVerified?: string;
  type?: "api" | "user"
  super_admin?: boolean;
  role?: string;
  favourite_agents?: string[];
};
