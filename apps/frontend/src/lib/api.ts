// API client for backend communication
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
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

export const apiClient = new ApiClient(API_BASE_URL);
