export interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Workspace {
    id: string;
    name: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
}
