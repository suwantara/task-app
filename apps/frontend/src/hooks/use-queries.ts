'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ─── Query Keys ────────────────────────────────────────────────

export const queryKeys = {
  profile: ['profile'] as const,
  workspaces: ['workspaces'] as const,
  workspace: (id: string) => ['workspace', id] as const,
  boards: (workspaceId: string) => ['boards', workspaceId] as const,
  board: (id: string) => ['board', id] as const,
  columns: (boardId: string) => ['columns', boardId] as const,
  tasks: (boardId: string) => ['tasks', boardId] as const,
  notes: (workspaceId: string) => ['notes', workspaceId] as const,
  note: (id: string) => ['note', id] as const,
  members: (workspaceId: string) => ['members', workspaceId] as const,
  inviteLinks: (workspaceId: string) => ['inviteLinks', workspaceId] as const,
};

// ─── Query Hooks ───────────────────────────────────────────────

export function useWorkspaces(options?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => apiClient.getWorkspaces(),
    ...options,
  });
}

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: queryKeys.workspace(id),
    queryFn: () => apiClient.getWorkspace(id),
    enabled: !!id,
  });
}

export function useBoards(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.boards(workspaceId),
    queryFn: () => apiClient.getBoards(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useBoard(id: string) {
  return useQuery({
    queryKey: queryKeys.board(id),
    queryFn: () => apiClient.getBoard(id),
    enabled: !!id,
  });
}

export function useColumns(boardId: string) {
  return useQuery({
    queryKey: queryKeys.columns(boardId),
    queryFn: () => apiClient.getColumns(boardId),
    enabled: !!boardId,
  });
}

export function useTasks(boardId: string) {
  return useQuery({
    queryKey: queryKeys.tasks(boardId),
    queryFn: () => apiClient.getTasks(boardId),
    enabled: !!boardId,
  });
}

export function useNotes(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.notes(workspaceId),
    queryFn: () => apiClient.getNotes(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useNote(id: string | null) {
  return useQuery({
    queryKey: queryKeys.note(id!),
    queryFn: () => apiClient.getNote(id!),
    enabled: !!id,
  });
}

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.members(workspaceId),
    queryFn: () => apiClient.getWorkspaceMembers(workspaceId),
    enabled: !!workspaceId,
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiClient.createWorkspace(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces });
    },
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { workspaceId: string; name: string; description?: string }) =>
      apiClient.createBoard(data.workspaceId, data.name, data.description),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.boards(variables.workspaceId) });
    },
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; name?: string; description?: string }) =>
      apiClient.updateBoard(data.id, { name: data.name, description: data.description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteBoard(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useCreateColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { boardId: string; name: string; position: number }) =>
      apiClient.createColumn(data.boardId, data.name, data.position),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.columns(variables.boardId) });
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      boardId: string;
      columnId: string;
      title: string;
      description?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH';
      position: number;
    }) => apiClient.createTask(data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks(variables.boardId) });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; boardId: string; updates: Record<string, unknown> }) =>
      apiClient.updateTask(data.id, data.updates as never),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks(variables.boardId) });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; boardId: string }) => apiClient.deleteTask(data.id),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks(variables.boardId) });
    },
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { workspaceId: string; title: string; content?: string }) =>
      apiClient.createNote(data.workspaceId, data.title, data.content),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.notes(variables.workspaceId) });
    },
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; workspaceId: string; title?: string; content?: string }) =>
      apiClient.updateNote(data.id, { title: data.title, content: data.content }),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.notes(variables.workspaceId) });
      qc.invalidateQueries({ queryKey: queryKeys.note(variables.id) });
    },
  });
}
