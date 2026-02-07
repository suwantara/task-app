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

interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number };
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
}
