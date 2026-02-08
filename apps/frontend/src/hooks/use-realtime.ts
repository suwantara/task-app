'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/contexts/socket-context';
import type { Task, Column, Note } from '@/lib/api';

interface RealtimeCallbacks {
  onTaskCreated?: (task: Task) => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (data: { id: string }) => void;
  onTaskMoved?: (data: {
    taskId: string;
    fromColumnId: string;
    toColumnId: string;
    position: number;
  }) => void;
  onColumnCreated?: (column: Column) => void;
  onColumnUpdated?: (column: Column) => void;
  onCursorUpdate?: (data: {
    socketId: string;
    userId: string;
    name: string;
    cursor: { x: number; y: number };
  }) => void;
}

interface NoteRealtimeCallbacks {
  onNoteCreated?: (note: Note) => void;
  onNoteUpdated?: (note: Note) => void;
  onNoteDeleted?: (data: { id: string }) => void;
  onNoteTyping?: (data: { noteId: string; userId: string; name: string }) => void;
  onNoteStopTyping?: (data: { noteId: string; userId: string }) => void;
}

export function useBoardRealtime(boardId: string | null, callbacks: RealtimeCallbacks) {
  const { socket, joinRoom, leaveRoom } = useSocket();
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

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

    // Use wrapper functions that read from ref — listeners stay stable across renders
    const onTaskCreated = (t: Task) => cbRef.current.onTaskCreated?.(t);
    const onTaskUpdated = (t: Task) => cbRef.current.onTaskUpdated?.(t);
    const onTaskDeleted = (d: { id: string }) => cbRef.current.onTaskDeleted?.(d);
    const onTaskMoved = (d: { taskId: string; fromColumnId: string; toColumnId: string; position: number }) =>
      cbRef.current.onTaskMoved?.(d);
    const onColumnCreated = (c: Column) => cbRef.current.onColumnCreated?.(c);
    const onColumnUpdated = (c: Column) => cbRef.current.onColumnUpdated?.(c);
    const onCursorUpdate = (d: { socketId: string; userId: string; name: string; cursor: { x: number; y: number } }) =>
      cbRef.current.onCursorUpdate?.(d);

    socket.on('task:created', onTaskCreated);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:deleted', onTaskDeleted);
    socket.on('task:moved', onTaskMoved);
    socket.on('column:created', onColumnCreated);
    socket.on('column:updated', onColumnUpdated);
    socket.on('cursor:update', onCursorUpdate);

    return () => {
      socket.off('task:created', onTaskCreated);
      socket.off('task:updated', onTaskUpdated);
      socket.off('task:deleted', onTaskDeleted);
      socket.off('task:moved', onTaskMoved);
      socket.off('column:created', onColumnCreated);
      socket.off('column:updated', onColumnUpdated);
      socket.off('cursor:update', onCursorUpdate);
    };
  }, [socket]);

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
  callbacks: NoteRealtimeCallbacks,
) {
  const { socket, joinRoom, leaveRoom } = useSocket();
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

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

    // Use wrapper functions that read from ref — listeners stay stable across renders
    const onNoteCreated = (n: Note) => cbRef.current.onNoteCreated?.(n);
    const onNoteUpdated = (n: Note) => cbRef.current.onNoteUpdated?.(n);
    const onNoteDeleted = (d: { id: string }) => cbRef.current.onNoteDeleted?.(d);
    const onNoteTyping = (d: { noteId: string; userId: string; name: string }) =>
      cbRef.current.onNoteTyping?.(d);
    const onNoteStopTyping = (d: { noteId: string; userId: string }) =>
      cbRef.current.onNoteStopTyping?.(d);

    socket.on('note:created', onNoteCreated);
    socket.on('note:updated', onNoteUpdated);
    socket.on('note:deleted', onNoteDeleted);
    socket.on('note:typing', onNoteTyping);
    socket.on('note:stop-typing', onNoteStopTyping);

    return () => {
      socket.off('note:created', onNoteCreated);
      socket.off('note:updated', onNoteUpdated);
      socket.off('note:deleted', onNoteDeleted);
      socket.off('note:typing', onNoteTyping);
      socket.off('note:stop-typing', onNoteStopTyping);
    };
  }, [socket]);

  // Emit typing status (only status, no content — content stays local until autosave)
  const emitTyping = useCallback(
    (noteId: string, userId: string, name: string) => {
      if (socket && workspaceId) {
        socket.emit('note:typing', {
          room: `workspace:${workspaceId}`,
          noteId,
          userId,
          name,
        });
      }
    },
    [socket, workspaceId],
  );

  const emitStopTyping = useCallback(
    (noteId: string, userId: string) => {
      if (socket && workspaceId) {
        socket.emit('note:stop-typing', {
          room: `workspace:${workspaceId}`,
          noteId,
          userId,
        });
      }
    },
    [socket, workspaceId],
  );

  return { emitTyping, emitStopTyping };
}
