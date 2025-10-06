export type User = {
  id: number;
  email: string;
  emailVerified?: string;
  type?: "api" | "user"
  super_admin?: boolean;
  favourite_agents?: string[];
  favourite_projects?: string[];
  role: {
    id: string;
    name: string;
    agents: "read" | "write";
    workflows: "read" | "write";
    evals: "read" | "write";
    variables: "read" | "write";
    users: "read" | "write";
  };
};
