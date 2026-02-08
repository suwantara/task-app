// API client for backend communication
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');

class ApiClient {
  private readonly baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    if (typeof globalThis.window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof globalThis.window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || 'An error occurred');
    }

    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name: string) {
    return this.request<{ access_token: string; user: User }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }
    );
  }

  async getProfile() {
    return this.request<User>('/auth/profile');
  }

  // Workspace endpoints
  async getWorkspaces() {
    return this.request<Workspace[]>('/workspaces');
  }

  async createWorkspace(name: string) {
    return this.request<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getWorkspace(id: string) {
    return this.request<Workspace>(`/workspaces/${id}`);
  }

  async deleteWorkspace(id: string) {
    return this.request<void>(`/workspaces/${id}`, { method: 'DELETE' });
  }

  // Board endpoints
  async getBoards(workspaceId: string) {
    return this.request<Board[]>(`/boards?workspaceId=${workspaceId}`);
  }

  async createBoard(workspaceId: string, name: string, description?: string) {
    return this.request<Board>('/boards', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, name, description }),
    });
  }

  async getBoard(id: string) {
    return this.request<Board>(`/boards/${id}`);
  }

  async updateBoard(id: string, data: { name?: string; description?: string }) {
    return this.request<Board>(`/boards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteBoard(id: string) {
    return this.request<void>(`/boards/${id}`, {
      method: 'DELETE',
    });
  }

  // Column endpoints
  async getColumns(boardId: string) {
    return this.request<Column[]>(`/columns?boardId=${boardId}`);
  }

  async createColumn(boardId: string, name: string, position: number) {
    return this.request<Column>('/columns', {
      method: 'POST',
      body: JSON.stringify({ boardId, name, position }),
    });
  }

  // Task endpoints
  async getTasks(boardId: string) {
    return this.request<Task[]>(`/tasks?boardId=${boardId}`);
  }

  async createTask(data: CreateTaskDto) {
    return this.request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: Partial<CreateTaskDto>) {
    return this.request<Task>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request<void>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Notes endpoints
  async getNotes(workspaceId: string) {
    return this.request<Note[]>(`/notes?workspaceId=${workspaceId}`);
  }

  async createNote(workspaceId: string, title: string, content?: string) {
    return this.request<Note>('/notes', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, title, content }),
    });
  }

  async getNote(id: string) {
    return this.request<Note>(`/notes/${id}`);
  }

  async updateNote(id: string, data: Partial<Note>) {
    return this.request<Note>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteNote(id: string) {
    return this.request<void>(`/notes/${id}`, {
      method: 'DELETE',
    });
  }

  // User settings endpoints
  async getUserProfile() {
    return this.request<User>('/users/me');
  }

  async updateUserProfile(data: { name?: string; email?: string; avatarUrl?: string }) {
    return this.request<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updatePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async getUserSettings() {
    return this.request<UserSettings>('/users/me/settings');
  }

  async updateUserSettings(data: Partial<UserSettings>) {
    return this.request<UserSettings>('/users/me/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAccount() {
    return this.request<{ message: string }>('/users/me', {
      method: 'DELETE',
    });
  }

  // Workspace invite link endpoints
  async createInviteLink(workspaceId: string, data?: { role?: string; expiresAt?: string; maxUses?: number }) {
    return this.request<InviteLink>(`/workspaces/${workspaceId}/invite-links`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async getInviteLinks(workspaceId: string) {
    return this.request<InviteLink[]>(`/workspaces/${workspaceId}/invite-links`);
  }

  async revokeInviteLink(linkId: string) {
    return this.request<InviteLink>(`/workspaces/invite-links/${linkId}`, {
      method: 'DELETE',
    });
  }

  async getInviteLinkInfo(token: string) {
    return this.request<InviteLinkInfo>(`/workspaces/join/${token}/info`);
  }

  async joinByInviteLink(token: string) {
    return this.request<{ workspace: { id: string; name: string }; alreadyMember: boolean }>(
      `/workspaces/join/${token}`,
      { method: 'POST' }
    );
  }

  // Workspace members endpoints
  async getWorkspaceMembers(workspaceId: string) {
    return this.request<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`);
  }

  async updateMemberRole(workspaceId: string, memberId: string, role: string) {
    return this.request<WorkspaceMember>(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async removeMember(workspaceId: string, memberId: string) {
    return this.request<void>(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  // Join codes endpoints
  async getJoinCodes(workspaceId: string) {
    return this.request<{ editorJoinCode: string; viewerJoinCode: string }>(
      `/workspaces/${workspaceId}/join-codes`
    );
  }

  async regenerateJoinCode(workspaceId: string, role: 'EDITOR' | 'VIEWER') {
    return this.request<{ code: string }>(
      `/workspaces/${workspaceId}/join-codes/${role}/regenerate`,
      { method: 'POST' }
    );
  }
}

// ─── Shared Types (canonical frontend definitions) ─────────────

export type MemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export const PRIORITY_CONFIG: Record<TaskPriority, { readonly label: string; readonly color: string }> = {
  HIGH: { label: 'High', color: 'bg-red-500' },
  MEDIUM: { label: 'Medium', color: 'bg-amber-500' },
  LOW: { label: 'Low', color: 'bg-emerald-500' },
} as const;

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl?: string;
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

export interface InviteLinkInfo {
  readonly workspaceName: string;
  readonly role: string;
  readonly isActive: boolean;
  readonly isExpired: boolean;
  readonly isMaxedOut: boolean;
  readonly memberCount: number;
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

export interface CreateTaskDto {
  readonly workspaceId: string;
  readonly boardId: string;
  readonly columnId: string;
  readonly title: string;
  readonly description?: string;
  readonly priority?: TaskPriority;
  readonly dueDate?: string;
  readonly assigneeId?: string;
  readonly position: number;
}

export interface Note {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly content?: string;
  readonly icon?: string;
  readonly coverImage?: string;
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

export const apiClient = new ApiClient(API_BASE_URL);
