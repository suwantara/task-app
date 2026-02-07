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
    return this.request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name: string) {
    return this.request<{ access_token: string; user: any }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }
    );
  }

  async getProfile() {
    return this.request<any>('/auth/profile');
  }

  // Workspace endpoints
  async getWorkspaces() {
    return this.request<any[]>('/workspaces');
  }

  async createWorkspace(name: string) {
    return this.request<any>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getWorkspace(id: string) {
    return this.request<any>(`/workspaces/${id}`);
  }

  // Board endpoints
  async getBoards(workspaceId: string) {
    return this.request<any[]>(`/boards?workspaceId=${workspaceId}`);
  }

  async createBoard(workspaceId: string, name: string, description?: string) {
    return this.request<any>('/boards', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, name, description }),
    });
  }

  async getBoard(id: string) {
    return this.request<any>(`/boards/${id}`);
  }

  // Column endpoints
  async getColumns(boardId: string) {
    return this.request<any[]>(`/columns?boardId=${boardId}`);
  }

  async createColumn(boardId: string, name: string, position: number) {
    return this.request<any>('/columns', {
      method: 'POST',
      body: JSON.stringify({ boardId, name, position }),
    });
  }

  // Task endpoints
  async getTasks(boardId: string) {
    return this.request<any[]>(`/tasks?boardId=${boardId}`);
  }

  async createTask(data: {
    workspaceId: string;
    boardId: string;
    columnId: string;
    title: string;
    description?: string;
    priority?: string;
    dueDate?: string;
    position: number;
  }) {
    return this.request<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: any) {
    return this.request<any>(`/tasks/${id}`, {
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
    return this.request<any[]>(`/notes?workspaceId=${workspaceId}`);
  }

  async createNote(workspaceId: string, title: string, content?: any) {
    return this.request<any>('/notes', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, title, content }),
    });
  }

  async getNote(id: string) {
    return this.request<any>(`/notes/${id}`);
  }

  async updateNote(id: string, data: any) {
    return this.request<any>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
