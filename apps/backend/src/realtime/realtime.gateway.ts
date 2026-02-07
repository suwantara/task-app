import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';

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
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Map<room, Map<socketId, PresenceUser>>
  private readonly roomPresence = new Map<string, Map<string, PresenceUser>>();

  // Map<noteId, Uint8Array> - stores Yjs document state
  private readonly yjsDocs = new Map<string, Uint8Array>();

  // Map<noteId, Set<socketId>> - tracks clients in each Yjs room
  private readonly yjsRooms = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // Remove from all rooms and notify
    for (const [room, members] of this.roomPresence.entries()) {
      if (members.has(client.id)) {
        members.delete(client.id);
        this.server.to(room).emit('presence:update', {
          users: Array.from(members.values()),
        });
        if (members.size === 0) {
          this.roomPresence.delete(room);
        }
      }
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { room: string; user?: PresenceUser },
    @ConnectedSocket() client: Socket,
  ) {
    const room = data.room;
    await client.join(room);

    // Track presence
    if (data.user) {
      if (!this.roomPresence.has(room)) {
        this.roomPresence.set(room, new Map());
      }
      this.roomPresence.get(room)!.set(client.id, data.user);
      this.server.to(room).emit('presence:update', {
        users: Array.from(this.roomPresence.get(room)!.values()),
      });
    }

    return { event: 'joinedRoom', data: room };
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ) {
    await client.leave(room);

    // Remove presence
    const members = this.roomPresence.get(room);
    if (members) {
      members.delete(client.id);
      this.server.to(room).emit('presence:update', {
        users: Array.from(members.values()),
      });
      if (members.size === 0) {
        this.roomPresence.delete(room);
      }
    }

    return { event: 'leftRoom', data: room };
  }

  @SubscribeMessage('cursor:move')
  handleCursorMove(
    @MessageBody() data: { room: string; cursor: { x: number; y: number } },
    @ConnectedSocket() client: Socket,
  ) {
    const members = this.roomPresence.get(data.room);
    if (members?.has(client.id)) {
      const user = members.get(client.id)!;
      user.cursor = data.cursor;
      members.set(client.id, user);
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

  @SubscribeMessage('note:editing')
  handleNoteEditing(
    @MessageBody()
    data: { room: string; noteId: string; userId: string; name: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.room).emit('note:someone-editing', {
      noteId: data.noteId,
      userId: data.userId,
      name: data.name,
    });
  }

  @SubscribeMessage('note:content-update')
  handleNoteContentUpdate(
    @MessageBody()
    data: {
      room: string;
      noteId: string;
      title: string;
      content: string;
      userId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.room).emit('note:content-changed', {
      noteId: data.noteId,
      title: data.title,
      content: data.content,
      userId: data.userId,
    });
  }

  @SubscribeMessage('note:stop-editing')
  handleNoteStopEditing(
    @MessageBody()
    data: { room: string; noteId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.room).emit('note:someone-stopped-editing', {
      noteId: data.noteId,
      userId: data.userId,
    });
  }

  // --- Page Presence ---

  @SubscribeMessage('presence:update-page')
  handleUpdatePage(
    @MessageBody() data: { room: string; page: string },
    @ConnectedSocket() client: Socket,
  ) {
    const members = this.roomPresence.get(data.room);
    if (members?.has(client.id)) {
      const user = members.get(client.id)!;
      user.currentPage = data.page;
      members.set(client.id, user);
      // Broadcast updated presence list
      this.server.to(data.room).emit('presence:update', {
        users: Array.from(members.values()),
      });
    }
  }

  // --- Yjs Collaborative Editing ---

  @SubscribeMessage('yjs:join')
  handleYjsJoin(
    @MessageBody() data: { noteId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `yjs:${data.noteId}`;
    void client.join(room);

    // Track client
    if (!this.yjsRooms.has(data.noteId)) {
      this.yjsRooms.set(data.noteId, new Set());
    }
    this.yjsRooms.get(data.noteId)!.add(client.id);

    // Send current doc state (if any)
    const docState = this.yjsDocs.get(data.noteId);
    client.emit('yjs:sync', {
      noteId: data.noteId,
      update: docState ? Array.from(docState) : [],
    });
  }

  @SubscribeMessage('yjs:update')
  handleYjsUpdate(
    @MessageBody() data: { noteId: string; update: number[] },
    @ConnectedSocket() client: Socket,
  ) {
    const updateArray = new Uint8Array(data.update);
    const room = `yjs:${data.noteId}`;

    // Properly merge update into stored doc state using Y.mergeUpdates
    const existing = this.yjsDocs.get(data.noteId);
    if (existing) {
      const merged = Y.mergeUpdates([existing, updateArray]);
      this.yjsDocs.set(data.noteId, merged);
    } else {
      this.yjsDocs.set(data.noteId, updateArray);
    }

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
      // Cleanup if no more clients
      if (clients.size === 0) {
        this.yjsRooms.delete(data.noteId);
        // Optionally keep yjsDocs for persistence, or clear:
        // this.yjsDocs.delete(data.noteId);
      }
    }
  }
}
