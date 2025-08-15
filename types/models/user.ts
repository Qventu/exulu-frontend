export type User = {
  id: string;
  email: string;
  emailVerified?: string;
  type?: "api" | "user"
  super_admin?: boolean;
  role?: {
    id: string;
    name: string;
    agents: "read" | "write";
    workflows: "read" | "write";
    variables: "read" | "write";
    users: "read" | "write";
  };
};
