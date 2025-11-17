import { PromptLibrary } from "@/types/models/prompt-library";
import { UserWithRole } from "@/types/models/user";

/**
 * Checks if a user has write access to a prompt
 *
 * @param prompt - The prompt to check access for
 * @param user - The user to check access for
 * @returns true if user has write access, false otherwise
 */
export function checkPromptWriteAccess(
  prompt: PromptLibrary,
  user: UserWithRole
): boolean {
  const isPrivate = prompt.rights_mode === "private";
  const isPublic = prompt.rights_mode === "public";
  const byUsers = prompt.rights_mode === "users";
  const byRoles = prompt.rights_mode === "roles";
  const isAdmin = user.super_admin;
  const isCreator = prompt.created_by === user.id.toString();

  let writeAccess = false;

  // Creator always has write access
  if (isCreator) {
    writeAccess = true;
  }

  // Private: only creator + admins
  if (isPrivate && !isCreator && !isAdmin) {
    writeAccess = false;
  }

  // Public: everyone has write access
  if (isPublic) {
    writeAccess = true;
  }

  // By users: check if user has write permission
  if (byUsers) {
    const userAccess = prompt.RBAC?.users?.find((u) => u.id === user.id);
    writeAccess = userAccess?.rights === "write";
  }

  // By roles: check if user's role has write permission
  if (byRoles) {
    const roleAccess = prompt.RBAC?.roles?.find((r) => r.id === user.role?.id);
    writeAccess = roleAccess?.rights === "write";
  }

  // Admin override
  if (isAdmin) {
    writeAccess = true;
  }

  return writeAccess;
}

/**
 * Checks if a user has read access to a prompt
 *
 * @param prompt - The prompt to check access for
 * @param user - The user to check access for
 * @returns true if user has read access, false otherwise
 */
export function checkPromptReadAccess(
  prompt: PromptLibrary,
  user: UserWithRole
): boolean {
  const isPrivate = prompt.rights_mode === "private";
  const isPublic = prompt.rights_mode === "public";
  const byUsers = prompt.rights_mode === "users";
  const byRoles = prompt.rights_mode === "roles";
  const isAdmin = user.super_admin;
  const isCreator = prompt.created_by === user.id.toString();

  // Creator always has read access
  if (isCreator) {
    return true;
  }

  // Admin always has read access
  if (isAdmin) {
    return true;
  }

  // Private: only creator + admins
  if (isPrivate) {
    return false;
  }

  // Public: everyone has read access
  if (isPublic) {
    return true;
  }

  // By users: check if user has read or write permission
  if (byUsers) {
    const userAccess = prompt.RBAC?.users?.find((u) => u.id === user.id);
    return userAccess !== undefined;
  }

  // By roles: check if user's role has read or write permission
  if (byRoles) {
    const roleAccess = prompt.RBAC?.roles?.find((r) => r.id === user.role?.id);
    return roleAccess !== undefined;
  }

  // By projects: would need project context to check
  if (prompt.rights_mode === "projects") {
    // This would require project context - for now return false
    // Can be enhanced when project context is available
    return false;
  }

  return false;
}
