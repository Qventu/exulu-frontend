export type User = {
  id: string;
  email: string;
  emailVerified?: string;
  type?: "api" | "user"
  super_admin?: boolean;
  roles?: {
    id: string;
    role: string;
  }[];
};
