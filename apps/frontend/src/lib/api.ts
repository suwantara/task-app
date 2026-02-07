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

// Types
interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members?: WorkspaceMember[];
  _count?: { members: number };
}

interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

interface InviteLink {
  id: string;
  workspaceId: string;
  token: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  isActive: boolean;
  expiresAt?: string;
  maxUses?: number;
  useCount: number;
  createdById: string;
  createdAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

interface InviteLinkInfo {
  workspaceName: string;
  role: string;
  isActive: boolean;
  isExpired: boolean;
  isMaxedOut: boolean;
  memberCount: number;
}

interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: string;
  workspaceId: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  position: number;
  creatorId?: string;
  assigneeId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateTaskDto {
  workspaceId: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
  position: number;
}

interface Note {
  id: string;
  workspaceId: string;
  title: string;
  content?: string;
  icon?: string;
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserSettings {
  id: string;
  userId: string;
  language: string;
  timezone: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  realtimeNotifications: boolean;
}

export const apiClient = new ApiClient(API_BASE_URL);
