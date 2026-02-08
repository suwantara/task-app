import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import { CacheService } from '../cache/cache.service';

interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number };
  currentPage?: string;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  // In-memory Yjs room tracking (per-instance, for cleanup only)
  private readonly yjsRooms = new Map<string, Set<string>>();

  constructor(private readonly cache: CacheService) {}

  /**
   * After the WebSocket server is initialized, subscribe to Redis pub/sub
   * channels and relay events to Socket.IO rooms.
   */
  async afterInit() {
    this.logger.log('WebSocket gateway initialized, setting up Redis subscriptions');

    // Subscribe to board events (task:created, task:updated, etc.)
    await this.cache.psubscribe('board:*', (channel, message) => {
      const msg = message as { event: string; data: unknown };
      this.server.to(channel).emit(msg.event, msg.data);
    });

    // Subscribe to workspace events (note:created, note:updated, etc.)
    await this.cache.psubscribe('workspace:*', (channel, message) => {
      const msg = message as { event: string; data: unknown };
      this.server.to(channel).emit(msg.event, msg.data);
    });

    this.logger.log('Redis pub/sub subscriptions active');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);

    // Get all rooms this socket belonged to
    const rooms = await this.cache.smembers(`socket:rooms:${client.id}`);

    // Remove presence from all rooms
    for (const room of rooms) {
      await this.cache.hdel(`presence:${room}`, client.id);
      // Broadcast updated presence
      const remaining = await this.getPresenceUsers(room);
      this.server.to(room).emit('presence:update', { users: remaining });
    }

    // Cleanup socket room tracking
    if (rooms.length > 0) {
      await this.cache.del(`socket:rooms:${client.id}`);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { room: string; user?: PresenceUser },
    @ConnectedSocket() client: Socket,
  ) {
    const room = data.room;
    await client.join(room);

    // Track presence in Redis
    if (data.user) {
      await this.cache.hset(
        `presence:${room}`,
        client.id,
        JSON.stringify(data.user),
      );
      await this.cache.sadd(`socket:rooms:${client.id}`, room);

      // Broadcast updated presence list
      const users = await this.getPresenceUsers(room);
      this.server.to(room).emit('presence:update', { users });
    }

    return { event: 'joinedRoom', data: room };
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ) {
    await client.leave(room);

    // Remove presence from Redis
    await this.cache.hdel(`presence:${room}`, client.id);
    await this.cache.srem(`socket:rooms:${client.id}`, room);

    // Broadcast updated presence list
    const users = await this.getPresenceUsers(room);
    this.server.to(room).emit('presence:update', { users });

    return { event: 'leftRoom', data: room };
  }

  @SubscribeMessage('cursor:move')
  async handleCursorMove(
    @MessageBody() data: { room: string; cursor: { x: number; y: number } },
    @ConnectedSocket() client: Socket,
  ) {
    // Update cursor in Redis presence
    const raw = await this.cache.hgetall(`presence:${data.room}`);
    const userJson = raw[client.id];
    if (userJson) {
      const user: PresenceUser = JSON.parse(userJson);
      const updated = { ...user, cursor: data.cursor };
      await this.cache.hset(
        `presence:${data.room}`,
        client.id,
        JSON.stringify(updated),
      );
      // Broadcast to others in the room
      client.to(data.room).emit('cursor:update', {
        socketId: client.id,
        userId: user.userId,
        name: user.name,
        cursor: data.cursor,
      });
    }
  }

  @SubscribeMessage('task:move')
  handleTaskMove(
    @MessageBody()
    data: {
      room: string;
      taskId: string;
      fromColumnId: string;
      toColumnId: string;
      position: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    // Broadcast to others in the board room
    client.to(data.room).emit('task:moved', {
      taskId: data.taskId,
      fromColumnId: data.fromColumnId,
      toColumnId: data.toColumnId,
      position: data.position,
    });
  }

  @SubscribeMessage('note:typing')
  handleNoteTyping(
    @MessageBody()
    data: { room: string; noteId: string; userId: string; name: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Broadcast typing status only (no content) to other users in the room
    client.to(data.room).emit('note:typing', {
      noteId: data.noteId,
      userId: data.userId,
      name: data.name,
    });
  }

  @SubscribeMessage('note:stop-typing')
  handleNoteStopTyping(
    @MessageBody()
    data: { room: string; noteId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.room).emit('note:stop-typing', {
      noteId: data.noteId,
      userId: data.userId,
    });
  }

  // --- Page Presence ---

  @SubscribeMessage('presence:update-page')
  async handleUpdatePage(
    @MessageBody() data: { room: string; page: string },
    @ConnectedSocket() client: Socket,
  ) {
    const raw = await this.cache.hgetall(`presence:${data.room}`);
    const userJson = raw[client.id];
    if (userJson) {
      const user: PresenceUser = JSON.parse(userJson);
      const updated = { ...user, currentPage: data.page };
      await this.cache.hset(
        `presence:${data.room}`,
        client.id,
        JSON.stringify(updated),
      );
      // Broadcast updated presence list
      const users = await this.getPresenceUsers(data.room);
      this.server.to(data.room).emit('presence:update', { users });
    }
  }

  // --- Yjs Collaborative Editing (state stored in Redis) ---

  @SubscribeMessage('yjs:join')
  async handleYjsJoin(
    @MessageBody() data: { noteId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `yjs:${data.noteId}`;
    void client.join(room);

    // Track client (in-memory per-instance for cleanup)
    if (!this.yjsRooms.has(data.noteId)) {
      this.yjsRooms.set(data.noteId, new Set());
    }
    this.yjsRooms.get(data.noteId)!.add(client.id);

    // Send current doc state from Redis
    const docBuffer = await this.cache.getBuffer(`yjs:doc:${data.noteId}`);
    client.emit('yjs:sync', {
      noteId: data.noteId,
      update: docBuffer ? Array.from(docBuffer) : [],
    });
  }

  @SubscribeMessage('yjs:update')
  async handleYjsUpdate(
    @MessageBody() data: { noteId: string; update: number[] },
    @ConnectedSocket() client: Socket,
  ) {
    const updateArray = new Uint8Array(data.update);
    const room = `yjs:${data.noteId}`;

    // Merge update into stored doc state in Redis
    const existing = await this.cache.getBuffer(`yjs:doc:${data.noteId}`);
    let merged: Uint8Array;
    if (existing) {
      merged = Y.mergeUpdates([new Uint8Array(existing), updateArray]);
    } else {
      merged = updateArray;
    }
    await this.cache.setBuffer(
      `yjs:doc:${data.noteId}`,
      Buffer.from(merged),
      86400, // 24h TTL
    );

    // Broadcast to others in the room
    client.to(room).emit('yjs:update', {
      noteId: data.noteId,
      update: data.update,
    });
  }

  @SubscribeMessage('yjs:awareness')
  handleYjsAwareness(
    @MessageBody() data: { noteId: string; update: number[] },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `yjs:${data.noteId}`;
    // Relay awareness to others
    client.to(room).emit('yjs:awareness', {
      noteId: data.noteId,
      update: data.update,
    });
  }

  @SubscribeMessage('yjs:leave')
  handleYjsLeave(
    @MessageBody() data: { noteId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `yjs:${data.noteId}`;
    void client.leave(room);

    // Remove client from tracking
    const clients = this.yjsRooms.get(data.noteId);
    if (clients) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.yjsRooms.delete(data.noteId);
        // Yjs doc stays in Redis for durability (TTL will expire it)
      }
    }
  }

  // --- Helpers ---

  private async getPresenceUsers(room: string): Promise<PresenceUser[]> {
    const raw = await this.cache.hgetall(`presence:${room}`);
    return Object.values(raw).map((json) => JSON.parse(json) as PresenceUser);
  }
}
