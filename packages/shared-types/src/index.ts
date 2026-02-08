// ─── Enums ─────────────────────────────────────────────────────

export const MemberRole = {
  OWNER: 'OWNER',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export const TaskPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

// ─── Realtime Event Names ──────────────────────────────────────

export const RealtimeEvent = {
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  TASK_MOVED: 'task:moved',
  COLUMN_CREATED: 'column:created',
  COLUMN_UPDATED: 'column:updated',
  NOTE_CREATED: 'note:created',
  NOTE_UPDATED: 'note:updated',
  NOTE_DELETED: 'note:deleted',
  PRESENCE_UPDATE: 'presence:update',
  CURSOR_UPDATE: 'cursor:update',
} as const;
export type RealtimeEvent = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

// ─── Domain Types ──────────────────────────────────────────────

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly members?: readonly WorkspaceMember[];
  readonly _count?: { readonly members: number };
}

export interface WorkspaceMember {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: MemberRole;
  readonly joinedAt: string;
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly avatarUrl?: string;
  };
}

export interface InviteLink {
  readonly id: string;
  readonly workspaceId: string;
  readonly token: string;
  readonly role: MemberRole;
  readonly isActive: boolean;
  readonly expiresAt?: string;
  readonly maxUses?: number;
  readonly useCount: number;
  readonly createdById: string;
  readonly createdAt: string;
  readonly createdBy?: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  };
}

export interface Board {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Column {
  readonly id: string;
  readonly boardId: string;
  readonly name: string;
  readonly position: number;
  readonly color?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Task {
  readonly id: string;
  readonly workspaceId: string;
  readonly boardId: string;
  readonly columnId: string;
  readonly title: string;
  readonly description?: string;
  readonly priority: TaskPriority;
  readonly position: number;
  readonly creatorId?: string;
  readonly assigneeId?: string;
  readonly dueDate?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly assignee?: {
    readonly id: string;
    readonly name: string;
    readonly avatarUrl?: string;
  };
}

export interface Note {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly content?: string;
  readonly icon?: string;
  readonly coverImage?: string;
  readonly creatorId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly creator?: {
    readonly id: string;
    readonly name: string;
    readonly avatarUrl?: string;
  };
}

export interface UserSettings {
  readonly id: string;
  readonly userId: string;
  readonly language: string;
  readonly timezone: string;
  readonly emailNotifications: boolean;
  readonly pushNotifications: boolean;
  readonly realtimeNotifications: boolean;
}

// ─── Auth Types ────────────────────────────────────────────────

export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
}

export interface AuthUser {
  readonly userId: string;
  readonly email: string;
}

export interface LoginResponse {
  readonly access_token: string;
  readonly user: User;
}

// ─── Priority Display Config ───────────────────────────────────

export const PRIORITY_CONFIG: Record<TaskPriority, { readonly label: string; readonly color: string }> = {
  HIGH: { label: 'High', color: 'bg-red-500' },
  MEDIUM: { label: 'Medium', color: 'bg-amber-500' },
  LOW: { label: 'Low', color: 'bg-emerald-500' },
} as const;

// ─── Error Messages ────────────────────────────────────────────

export const ErrorMessages = {
  NOT_WORKSPACE_MEMBER: 'Access denied: You are not a member of this workspace',
  BOARD_NOT_FOUND: 'Board not found',
  COLUMN_NOT_FOUND: 'Column not found',
  TASK_NOT_FOUND: 'Task not found',
  NOTE_NOT_FOUND: 'Note not found',
  USER_NOT_FOUND: 'User not found',
  ACCESS_DENIED: 'Access denied',
} as const;
