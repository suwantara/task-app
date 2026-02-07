import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  // Board events
  emitTaskCreated(boardId: string, task: unknown) {
    this.gateway.server.to(`board:${boardId}`).emit('task:created', task);
  }

  emitTaskUpdated(boardId: string, task: unknown) {
    this.gateway.server.to(`board:${boardId}`).emit('task:updated', task);
  }

  emitTaskDeleted(boardId: string, taskId: string) {
    this.gateway.server.to(`board:${boardId}`).emit('task:deleted', { id: taskId });
  }

  emitColumnCreated(boardId: string, column: unknown) {
    this.gateway.server.to(`board:${boardId}`).emit('column:created', column);
  }

  emitColumnUpdated(boardId: string, column: unknown) {
    this.gateway.server.to(`board:${boardId}`).emit('column:updated', column);
  }

  // Note events
  emitNoteUpdated(workspaceId: string, note: unknown) {
    this.gateway.server.to(`workspace:${workspaceId}`).emit('note:updated', note);
  }

  // Presence
  emitPresenceUpdate(room: string, data: unknown) {
    this.gateway.server.to(room).emit('presence:update', data);
  }
}
