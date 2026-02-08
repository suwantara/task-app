'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { TaskPriority } from '@/lib/api';

// ─── Query Keys ────────────────────────────────────────────────

export const queryKeys = {
  profile: ['profile'] as const,
  workspaces: ['workspaces'] as const,
  workspace: (id: string) => ['workspace', id] as const,
  boards: (workspaceId: string) => ['boards', workspaceId] as const,
  board: (id: string) => ['board', id] as const,
  columns: (boardId: string) => ['columns', boardId] as const,
  tasks: (boardId: string) => ['tasks', boardId] as const,
  allTasks: (workspaceId: string) => ['allTasks', workspaceId] as const,
  notes: (workspaceId: string) => ['notes', workspaceId] as const,
  note: (id: string) => ['note', id] as const,
  members: (workspaceId: string) => ['members', workspaceId] as const,
  inviteLinks: (workspaceId: string) => ['inviteLinks', workspaceId] as const,
  joinCodes: (workspaceId: string) => ['joinCodes', workspaceId] as const,
};

// ─── Query Hooks ───────────────────────────────────────────────

export function useWorkspaces(options?: { enabled?: boolean }) {
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

/** Fetches ALL tasks across all boards in a workspace (aggregated). */
export function useAllWorkspaceTasks(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.allTasks(workspaceId),
    queryFn: async () => {
      const boards = await apiClient.getBoards(workspaceId);
      const boardResults = await Promise.all(
        boards.map(async (board: { id: string; name: string }) => {
          const [columns, tasks] = await Promise.all([
            apiClient.getColumns(board.id),
            apiClient.getTasks(board.id),
          ]);
          return { board, columns, tasks };
        }),
      );
      return { boards, boardResults };
    },
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
    mutationFn: (data: { id: string; workspaceId: string; name?: string; description?: string }) =>
      apiClient.updateBoard(data.id, { name: data.name, description: data.description }),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.boards(variables.workspaceId) });
      qc.invalidateQueries({ queryKey: queryKeys.board(variables.id) });
    },
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; workspaceId: string }) =>
      apiClient.deleteBoard(data.id),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.boards(variables.workspaceId) });
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
      priority?: TaskPriority;
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
      apiClient.updateTask(data.id, data.updates),
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
  return useMutation({
    mutationFn: (data: { id: string; workspaceId: string; title?: string; content?: string }) =>
      apiClient.updateNote(data.id, { title: data.title, content: data.content }),
    // No invalidateQueries — realtime broadcast handles cache updates for all clients
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; workspaceId: string }) =>
      apiClient.deleteNote(data.id),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.notes(variables.workspaceId) });
    },
  });
}

// ─── Share Dialog Hooks ────────────────────────────────────────

export function useInviteLinks(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.inviteLinks(workspaceId),
    queryFn: () => apiClient.getInviteLinks(workspaceId).catch(() => []),
    enabled: !!workspaceId,
  });
}

export function useJoinCodes(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.joinCodes(workspaceId),
    queryFn: () => apiClient.getJoinCodes(workspaceId).catch(() => null),
    enabled: !!workspaceId && enabled,
  });
}

export function useRevokeInviteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { linkId: string; workspaceId: string }) =>
      apiClient.revokeInviteLink(data.linkId),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.inviteLinks(variables.workspaceId) });
    },
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { workspaceId: string; memberId: string; role: string }) =>
      apiClient.updateMemberRole(data.workspaceId, data.memberId, data.role),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.members(variables.workspaceId) });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { workspaceId: string; memberId: string }) =>
      apiClient.removeMember(data.workspaceId, data.memberId),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.members(variables.workspaceId) });
    },
  });
}

export function useRegenerateJoinCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { workspaceId: string; role: 'EDITOR' | 'VIEWER' }) =>
      apiClient.regenerateJoinCode(data.workspaceId, data.role),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.joinCodes(variables.workspaceId) });
    },
  });
}
