import type { UserWithRole } from "@/types/models/user";

/**
 * Synthetic demo user that satisfies the Authenticated shell's UserWithRole
 * prop without touching the network or auth layer.
 *
 * UserWithRole extends User (role: string) with role: { id: string; ... },
 * creating an intersection the TypeScript compiler considers impossible at the
 * object-literal level — the same reason serverSideAuthCheck uses `user: any`
 * internally. The cast here is the only correct place to absorb it; layout.tsx
 * stays cast-free and the demo-user shape is enforced by the return annotation.
 */
export function getDemoUser(): UserWithRole {
  return {
    id: 0,
    email: "demo@example.test",
    type: "user",
    super_admin: false,
    role: {
      id: "demo-role",
      name: "Demo",
      agents: "read",
      workflows: "read",
      evals: "read",
      variables: "read",
      users: "read",
    },
  } as unknown as UserWithRole;
}
