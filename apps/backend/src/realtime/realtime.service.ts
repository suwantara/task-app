import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

/**
 * RealtimeService publishes domain events to Redis pub/sub channels.
 * The RealtimeGateway subscribes to these channels and relays to Socket.IO clients.
 * This decouples services from Socket.IO and enables cross-instance event propagation.
 */
@Injectable()
export class RealtimeService {
  constructor(private readonly cache: CacheService) {}

  // Board events
  emitTaskCreated(boardId: string, task: unknown) {
    void this.cache.publish(`board:${boardId}`, {
      event: 'task:created',
      data: task,
    });
  }

  emitTaskUpdated(boardId: string, task: unknown) {
    void this.cache.publish(`board:${boardId}`, {
      event: 'task:updated',
      data: task,
    });
  }

  emitTaskDeleted(boardId: string, taskId: string) {
    void this.cache.publish(`board:${boardId}`, {
      event: 'task:deleted',
      data: { id: taskId },
    });
  }

  emitColumnCreated(boardId: string, column: unknown) {
    void this.cache.publish(`board:${boardId}`, {
      event: 'column:created',
      data: column,
    });
  }

  emitColumnUpdated(boardId: string, column: unknown) {
    void this.cache.publish(`board:${boardId}`, {
      event: 'column:updated',
      data: column,
    });
  }

  // Note events
  emitNoteCreated(workspaceId: string, note: unknown) {
    void this.cache.publish(`workspace:${workspaceId}`, {
      event: 'note:created',
      data: note,
    });
  }

  emitNoteUpdated(workspaceId: string, note: unknown) {
    void this.cache.publish(`workspace:${workspaceId}`, {
      event: 'note:updated',
      data: note,
    });
  }

  emitNoteDeleted(workspaceId: string, noteId: string) {
    void this.cache.publish(`workspace:${workspaceId}`, {
      event: 'note:deleted',
      data: { id: noteId },
    });
  }

  // Presence
  emitPresenceUpdate(room: string, data: unknown) {
    void this.cache.publish(room, {
      event: 'presence:update',
      data,
    });
  }
}
