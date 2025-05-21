export type UserRole = {
  id: string;
  name: string;
  is_admin: boolean;
  agents?: string[];
};
