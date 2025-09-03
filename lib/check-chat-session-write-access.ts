import { AgentSession } from "@/types/models/agent-session";
import { User } from "@/types/models/user";

export const checkChatSessionWriteAccess = (session: AgentSession, user: User) => {
    const isPrivate = session.rights_mode === 'private';
    const isPublic = session.rights_mode === 'public';
    const byUsers = session.rights_mode === 'users';
    const byRoles = session.rights_mode === 'roles';
    const isAdmin = user.super_admin;
    const isCreator = session.created_by === user.id;
  
    let writeAccess = false;
    if (isPrivate && isCreator) {
      writeAccess = true;
    }
    if (isPublic) {
      writeAccess = true;
    }
    if (byUsers) {
      writeAccess = session.RBAC?.users?.find(u => u.id === user.id)?.rights === 'write';
    }
    if (byRoles) {
      writeAccess = session.RBAC?.roles?.find(r => r.id === user.role?.id)?.rights === 'write';
    }
    if (isAdmin) {
      writeAccess = true;
    }
    return writeAccess;
}