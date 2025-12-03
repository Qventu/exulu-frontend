export interface Project {
    id: string;
    name: string;
    description: string;
    custom_instructions: string;
    rights_mode?: 'private' | 'users' | 'roles' | 'public'/*  | 'projects' */;
    created_by?: string;
    project_items?: string[]; // array of items as global ids ('<context_id>/<item_id>')
    RBAC?: {
        type?: string;
        users?: Array<{ id: number; rights: 'read' | 'write' }>;
        roles?: Array<{ id: string; rights: 'read' | 'write' }>;
        // projects?: Array<{ id: string; rights: 'read' | 'write' }>;
    };
    createdAt?: string;
    updatedAt?: string;
}