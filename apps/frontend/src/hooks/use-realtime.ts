'use client';

import { useEffect, useCallback } from 'react';
import { useSocket } from '@/contexts/socket-context';

interface RealtimeCallbacks {
  onTaskCreated?: (task: unknown) => void;
  onTaskUpdated?: (task: unknown) => void;
  onTaskDeleted?: (data: { id: string }) => void;
  onTaskMoved?: (data: {
    taskId: string;
    fromColumnId: string;
    toColumnId: string;
    position: number;
  }) => void;
  onColumnCreated?: (column: unknown) => void;
  onColumnUpdated?: (column: unknown) => void;
  onCursorUpdate?: (data: {
    socketId: string;
    userId: string;
    name: string;
    cursor: { x: number; y: number };
  }) => void;
}

export function useBoardRealtime(boardId: string | null, callbacks: RealtimeCallbacks) {
  const { socket, joinRoom, leaveRoom } = useSocket();

  useEffect(() => {
    if (!boardId) return;
    const room = `board:${boardId}`;
    joinRoom(room);
    return () => {
      leaveRoom(room);
    };
  }, [boardId, joinRoom, leaveRoom]);

  useEffect(() => {
    if (!socket) return;

    const handlers: [string, (...args: unknown[]) => void][] = [];

    if (callbacks.onTaskCreated) {
      const h = callbacks.onTaskCreated;
      socket.on('task:created', h);
      handlers.push(['task:created', h]);
    }
    if (callbacks.onTaskUpdated) {
      const h = callbacks.onTaskUpdated;
      socket.on('task:updated', h);
      handlers.push(['task:updated', h]);
    }
    if (callbacks.onTaskDeleted) {
      const h = callbacks.onTaskDeleted as (...args: unknown[]) => void;
      socket.on('task:deleted', h);
      handlers.push(['task:deleted', h]);
    }
    if (callbacks.onTaskMoved) {
      const h = callbacks.onTaskMoved as (...args: unknown[]) => void;
      socket.on('task:moved', h);
      handlers.push(['task:moved', h]);
    }
    if (callbacks.onColumnCreated) {
      const h = callbacks.onColumnCreated;
      socket.on('column:created', h);
      handlers.push(['column:created', h]);
    }
    if (callbacks.onColumnUpdated) {
      const h = callbacks.onColumnUpdated;
      socket.on('column:updated', h);
      handlers.push(['column:updated', h]);
    }
    if (callbacks.onCursorUpdate) {
      const h = callbacks.onCursorUpdate as (...args: unknown[]) => void;
      socket.on('cursor:update', h);
      handlers.push(['cursor:update', h]);
    }

    return () => {
      for (const [event, handler] of handlers) {
        socket.off(event, handler);
      }
    };
  }, [socket, callbacks]);

  const emitTaskMove = useCallback(
    (taskId: string, fromColumnId: string, toColumnId: string, position: number) => {
      if (socket && boardId) {
        socket.emit('task:move', {
          room: `board:${boardId}`,
          taskId,
          fromColumnId,
          toColumnId,
          position,
        });
      }
    },
    [socket, boardId],
  );

  return { emitTaskMove };
}

export function useNoteRealtime(
  workspaceId: string | null,
  callbacks: {
    onNoteUpdated?: (note: unknown) => void;
  },
) {
  const { socket, joinRoom, leaveRoom } = useSocket();

  useEffect(() => {
    if (!workspaceId) return;
    const room = `workspace:${workspaceId}`;
    joinRoom(room);
    return () => {
      leaveRoom(room);
    };
  }, [workspaceId, joinRoom, leaveRoom]);

  useEffect(() => {
    if (!socket) return;

    const handlers: [string, (...args: unknown[]) => void][] = [];

    if (callbacks.onNoteUpdated) {
      const h = callbacks.onNoteUpdated;
      socket.on('note:updated', h);
      handlers.push(['note:updated', h]);
    }

    return () => {
      for (const [event, handler] of handlers) {
        socket.off(event, handler);
      }
    };
  }, [socket, callbacks]);
}
