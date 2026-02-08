# Real-Time Collaborative Notes Architecture

## Overview

Arsitektur untuk aplikasi collaborative notes dengan real-time synchronization menggunakan:
- **Frontend**: Next.js (deployed on Vercel)
- **Backend**: Nest.js (deployed on Railway)
- **Database**: PostgreSQL (Railway)
- **Cache/Queue**: Redis (Railway)
- **Real-time**: Socket.IO
- **Editor**: Tiptap with Yjs (CRDT)
- **State Management**: Tanstack Query

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│  VERCEL (Next.js Frontend)                      │
│  ├─ React Components                            │
│  ├─ Tiptap Editor (with Yjs CRDT)              │
│  ├─ Tanstack Query (REST API calls)            │
│  └─ Socket.IO Client (WebSocket to Railway)    │
└─────────────┬───────────────────────────────────┘
              │
              │ REST API (HTTP/HTTPS)
              │ WebSocket (Socket.IO)
              ↓
┌──────────────────────────────────────────────────┐
│  RAILWAY (Nest.js Backend)                       │
│  ┌────────────────────────────────────────────┐  │
│  │  HTTP Server (REST API)                    │  │
│  │  • GET /notes/:id                          │  │
│  │  • POST /notes                             │  │
│  │  • PATCH /notes/:id                        │  │
│  │  • GET /health                             │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │  WebSocket Server (Socket.IO Gateway)     │  │
│  │  • note:join / note:leave                  │  │
│  │  • note:update (broadcasts)                │  │
│  │  • cursor:update                           │  │
│  │  • user presence tracking                  │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │  Background Worker (BullMQ)                │  │
│  │  • Processes persistence queue             │  │
│  │  • Batch database writes                   │  │
│  │  • Retry failed operations                 │  │
│  └────────────────────────────────────────────┘  │
└──────┬─────────────────────┬────────────────────┘
       │                     │
       ↓                     ↓
┌──────────────┐      ┌─────────────────┐
│    REDIS     │      │   POSTGRESQL    │
│  (Railway)   │      │   (Railway)     │
│              │      │                 │
│ • Cache      │      │ • Notes         │
│ • Presence   │      │ • Users         │
│ • Job Queue  │      │ • Yjs State     │
│ • Pub/Sub    │      │ • Snapshots     │
└──────────────┘      └─────────────────┘
```

---

## Data Flow

### Real-time Update Flow

```
User types in Tiptap Editor (Frontend)
    ↓
Yjs generates update delta (CRDT)
    ↓
Socket.IO emits 'note:update' to Railway
    ↓
Backend receives update
    ↓
┌─────────────────────────────────────────┐
│ STEP 1: IMMEDIATE BROADCAST (Priority)  │
│ Broadcast delta to all other users      │
│ in the same note room                   │
│ Latency: ~10-50ms                       │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STEP 2: REDIS CACHE (Non-blocking)      │
│ Store delta in Redis list               │
│ Update user presence                    │
│ Latency: ~5-20ms                        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STEP 3: QUEUE FOR PERSISTENCE           │
│ Add job to BullMQ queue                 │
│ Deduplication by noteId + timestamp     │
│ Latency: ~1-5ms (async)                 │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STEP 4: BACKGROUND PERSISTENCE          │
│ Worker processes queue                  │
│ Batch writes to PostgreSQL              │
│ Updates Yjs state in database           │
│ Executed: every 5-10 seconds            │
└─────────────────────────────────────────┘
```

### Why This Order?

1. **Broadcast First**: Users see changes immediately (real-time feel)
2. **Cache Second**: Fast recovery if user reconnects
3. **Database Last**: Eventual consistency, optimized batch writes

---

## Frontend Implementation (Vercel - Next.js)

### 1. Socket.IO Client Setup

**File**: `lib/socket.ts`

```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      autoConnect: false,
    });

    socket.on('connect', () => {
      console.log('✅ Connected to Railway WebSocket');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from Railway');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
```

**Key Points**:
- Singleton pattern untuk 1 connection per client
- Auto-reconnect dengan exponential backoff
- Fallback ke polling jika WebSocket gagal
- Manual connect setelah authentication

---

### 2. Collaborative Editor Component

**File**: `components/CollaborativeEditor.tsx`

```typescript
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { useEffect, useMemo, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useQuery } from '@tanstack/react-query';

interface CollaborativeEditorProps {
  noteId: string;
  userId: string;
  userName: string;
}

export default function CollaborativeEditor({ 
  noteId, 
  userId, 
  userName 
}: CollaborativeEditorProps) {
  const socket = getSocket();
  const [isConnected, setIsConnected] = useState(false);

  // Yjs document untuk CRDT (Conflict-free Replicated Data Type)
  const ydoc = useMemo(() => new Y.Doc(), []);
  
  // Fetch initial content via REST API
  const { data: initialContent, isLoading } = useQuery({
    queryKey: ['note', noteId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/notes/${noteId}`
      );
      if (!res.ok) throw new Error('Failed to fetch note');
      return res.json();
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Disable karena pakai Collaboration
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: null,
        user: {
          name: userName,
          color: getRandomColor(userId),
        },
      }),
    ],
    content: initialContent?.content || '',
  });

  useEffect(() => {
    if (!socket || !editor) return;

    // Connect socket
    socket.connect();

    // Join room untuk note ini
    socket.emit('note:join', { noteId, userId, userName });

    // Listen untuk updates dari user lain
    socket.on('note:updated', ({ delta, userId: senderId }) => {
      if (senderId !== userId) {
        // Apply update dari user lain ke local Yjs doc
        Y.applyUpdate(ydoc, new Uint8Array(delta));
      }
    });

    // Listen untuk cursor updates
    socket.on('cursor:update', ({ userId: cursorUserId, position }) => {
      // Update cursor position di editor
      // Implementation depends on your UI needs
    });

    // Listen untuk user presence
    socket.on('user:joined', ({ userId, userName }) => {
      console.log(`${userName} joined the note`);
    });

    socket.on('user:left', ({ userId }) => {
      console.log(`User ${userId} left the note`);
    });

    socket.on('users:list', (users) => {
      console.log('Active users:', users);
    });

    // Kirim local changes ke server
    ydoc.on('update', (update: Uint8Array) => {
      socket.emit('note:update', {
        noteId,
        delta: Array.from(update),
        userId,
      });
    });

    setIsConnected(true);

    return () => {
      socket.emit('note:leave', { noteId, userId });
      socket.off('note:updated');
      socket.off('cursor:update');
      socket.off('user:joined');
      socket.off('user:left');
      socket.off('users:list');
      ydoc.off('update');
    };
  }, [socket, editor, noteId, userId, userName, ydoc]);

  // Auto-save backup via REST API
  useEffect(() => {
    if (!editor) return;

    const saveTimer = setTimeout(() => {
      const content = editor.getJSON();
      
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }).catch(err => console.error('Auto-save failed:', err));
    }, 5000);

    return () => clearTimeout(saveTimer);
  }, [editor?.state.doc, noteId]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <div 
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} 
        />
        <span className="text-sm text-gray-600">
          {isConnected ? 'Connected' : 'Connecting...'}
        </span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function getRandomColor(userId: string): string {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'];
  const hash = userId.split('').reduce(
    (acc, char) => acc + char.charCodeAt(0), 
    0
  );
  return colors[hash % colors.length];
}
```

**Key Concepts**:
- **Yjs (CRDT)**: Automatic conflict resolution
- **Optimistic Updates**: Local changes appear immediately
- **Delta Sync**: Only send changes, not full document
- **Presence Awareness**: Show who's online
- **Backup Saves**: Periodic REST API saves as fallback

---

### 3. Environment Variables

**File**: `.env.local` (Vercel)

```bash
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_SOCKET_URL=https://your-backend.railway.app
```

**Vercel Dashboard Settings**:
- Add these in Project Settings → Environment Variables
- Apply to Production, Preview, and Development

---

## Backend Implementation (Railway - Nest.js)

### Project Structure

```
src/
├── main.ts                           # Bootstrap
├── app.module.ts                     # Root module
├── notes/
│   ├── notes.module.ts
│   ├── notes.controller.ts           # REST endpoints
│   ├── notes.service.ts              # Business logic
│   ├── notes.gateway.ts              # Socket.IO gateway
│   └── dto/
│       ├── create-note.dto.ts
│       └── update-note.dto.ts
├── redis/
│   ├── redis.module.ts
│   ├── redis.service.ts              # Redis operations
│   └── redis-io.adapter.ts           # Multi-instance support
├── queue/
│   ├── queue.module.ts
│   ├── queue.service.ts              # BullMQ service
│   └── processors/
│       └── note-persistence.processor.ts
├── database/
│   ├── prisma/
│   │   └── schema.prisma
│   └── prisma.service.ts
└── health/
    └── health.controller.ts          # Health checks
```

---

### 1. Main Bootstrap

**File**: `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { RedisIoAdapter } from './redis/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // CORS untuk Vercel
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://your-app.vercel.app',
      /\.vercel\.app$/, // All preview deployments
    ],
    credentials: true,
  });

  // Redis adapter untuk multi-instance Socket.IO
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = configService.get('PORT') || 3000;
  await app.listen(port, '0.0.0.0'); // Important: 0.0.0.0 for Railway

  console.log(`🚀 Server running on port ${port}`);
  console.log(`🔌 WebSocket ready`);
}

bootstrap();
```

**Key Points**:
- CORS includes all Vercel preview deployments
- Redis adapter enables horizontal scaling
- Listen on `0.0.0.0` for Railway networking

---

### 2. Redis Adapter (Multi-Instance Support)

**File**: `src/redis/redis-io.adapter.ts`

```typescript
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { INestApplicationContext } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({ 
      url: process.env.REDIS_URL 
    });
    const subClient = pubClient.duplicate();

    await Promise.all([
      pubClient.connect(),
      subClient.connect(),
    ]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    console.log('✅ Redis adapter connected');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

**Why This Matters**:
- Enables multiple Railway instances
- Broadcasts work across all servers
- Redis Pub/Sub for message distribution

---

### 3. WebSocket Gateway

**File**: `src/notes/notes.gateway.ts`

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { QueueService } from '../queue/queue.service';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'https://your-app.vercel.app',
      /\.vercel\.app$/,
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotesGateway 
  implements OnGatewayConnection, OnGatewayDisconnect {
  
  @WebSocketServer()
  server: Server;

  private logger = new Logger('NotesGateway');

  constructor(
    private redisService: RedisService,
    private queueService: QueueService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Cleanup user presence
  }

  @SubscribeMessage('note:join')
  async handleJoinNote(
    @MessageBody() data: { 
      noteId: string; 
      userId: string; 
      userName: string 
    },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `note:${data.noteId}`;
    
    // Join Socket.IO room
    await client.join(room);
    
    // Update presence in Redis
    await this.redisService.addUserToNote(data.noteId, {
      userId: data.userId,
      userName: data.userName,
      socketId: client.id,
    });

    // Notify room
    client.to(room).emit('user:joined', {
      userId: data.userId,
      userName: data.userName,
    });

    // Send active users to joining client
    const activeUsers = await this.redisService.getNoteUsers(data.noteId);
    client.emit('users:list', activeUsers);

    this.logger.log(`User ${data.userName} joined note ${data.noteId}`);
  }

  @SubscribeMessage('note:leave')
  async handleLeaveNote(
    @MessageBody() data: { noteId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `note:${data.noteId}`;
    
    await client.leave(room);
    await this.redisService.removeUserFromNote(data.noteId, data.userId);

    client.to(room).emit('user:left', { userId: data.userId });
  }

  @SubscribeMessage('note:update')
  async handleNoteUpdate(
    @MessageBody() data: { 
      noteId: string; 
      delta: number[]; 
      userId: string 
    },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `note:${data.noteId}`;

    // PRIORITY 1: Broadcast immediately (fastest path)
    client.to(room).emit('note:updated', {
      delta: data.delta,
      userId: data.userId,
      timestamp: Date.now(),
    });

    // PRIORITY 2: Cache in Redis (non-blocking)
    this.redisService
      .cacheNoteDelta(data.noteId, data.delta)
      .catch(err => {
        this.logger.error(`Redis cache error: ${err.message}`);
      });

    // PRIORITY 3: Queue for database (background)
    this.queueService
      .addNotePersistenceJob({
        noteId: data.noteId,
        delta: data.delta,
        userId: data.userId,
        timestamp: Date.now(),
      })
      .catch(err => {
        this.logger.error(`Queue error: ${err.message}`);
      });

    return { success: true };
  }

  @SubscribeMessage('cursor:update')
  handleCursorUpdate(
    @MessageBody() data: { 
      noteId: string; 
      userId: string; 
      position: any 
    },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `note:${data.noteId}`;
    
    // Broadcast cursor (no persistence needed)
    client.to(room).emit('cursor:update', {
      userId: data.userId,
      position: data.position,
    });
  }
}
```

**Event Flow**:
1. `note:join` → User enters note, gets presence list
2. `note:update` → Delta broadcast → Redis cache → DB queue
3. `cursor:update` → Real-time cursor sharing (ephemeral)
4. `note:leave` → Cleanup presence

---

### 4. Redis Service

**File**: `src/redis/redis.service.ts`

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit {
  public client: Redis;
  private logger = new Logger('RedisService');

  constructor(private configService: ConfigService) {
    this.client = new Redis(this.configService.get('REDIS_URL'), {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  async onModuleInit() {
    this.client.on('connect', () => {
      this.logger.log('✅ Redis connected');
    });

    this.client.on('error', (err) => {
      this.logger.error(`❌ Redis error: ${err.message}`);
    });
  }

  // ============ USER PRESENCE ============
  
  async addUserToNote(noteId: string, user: {
    userId: string;
    userName: string;
    socketId: string;
  }) {
    const key = `note:${noteId}:users`;
    await this.client.hset(key, user.userId, JSON.stringify(user));
    await this.client.expire(key, 3600); // TTL 1 hour
  }

  async removeUserFromNote(noteId: string, userId: string) {
    const key = `note:${noteId}:users`;
    await this.client.hdel(key, userId);
  }

  async getNoteUsers(noteId: string) {
    const key = `note:${noteId}:users`;
    const users = await this.client.hgetall(key);
    return Object.values(users).map(u => JSON.parse(u));
  }

  // ============ DELTA CACHING ============

  async cacheNoteDelta(noteId: string, delta: number[]) {
    const key = `note:${noteId}:deltas`;
    
    await this.client.lpush(key, JSON.stringify({
      delta,
      timestamp: Date.now(),
    }));
    
    // Keep last 100 deltas
    await this.client.ltrim(key, 0, 99);
    
    // TTL 30 minutes
    await this.client.expire(key, 1800);
  }

  async getCachedDeltas(noteId: string) {
    const key = `note:${noteId}:deltas`;
    const deltas = await this.client.lrange(key, 0, -1);
    return deltas.map(d => JSON.parse(d));
  }

  // ============ CONTENT SNAPSHOT ============

  async setNoteContent(noteId: string, content: any) {
    const key = `note:${noteId}:content`;
    await this.client.set(
      key, 
      JSON.stringify(content), 
      'EX', 
      3600 // 1 hour TTL
    );
  }

  async getNoteContent(noteId: string) {
    const key = `note:${noteId}:content`;
    const content = await this.client.get(key);
    return content ? JSON.parse(content) : null;
  }

  // ============ RATE LIMITING ============

  async checkRateLimit(
    userId: string, 
    limit: number = 50, 
    windowSeconds: number = 1
  ): Promise<boolean> {
    const key = `rate-limit:${userId}`;
    const current = await this.client.incr(key);
    
    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }
    
    return current <= limit;
  }
}
```

**Redis Data Structure**:
- `note:{noteId}:users` → Hash of active users
- `note:{noteId}:deltas` → List of recent deltas
- `note:{noteId}:content` → Full content snapshot
- `rate-limit:{userId}` → Rate limiting counter

---

### 5. Queue Service (BullMQ)

**File**: `src/queue/queue.service.ts`

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueueService implements OnModuleInit {
  private notePersistenceQueue: Queue;
  private logger = new Logger('QueueService');

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get('REDIS_URL');
    const redisConnection = this.parseRedisUrl(redisUrl);

    this.notePersistenceQueue = new Queue('note-persistence', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 100,
          age: 3600, // 1 hour
        },
        removeOnFail: {
          count: 500,
        },
      },
    });

    this.logger.log('✅ BullMQ Queue initialized');
  }

  async addNotePersistenceJob(data: {
    noteId: string;
    delta: number[];
    userId: string;
    timestamp: number;
  }) {
    // Job deduplication: same noteId within 5 second window
    const jobId = `${data.noteId}-${Math.floor(data.timestamp / 5000)}`;
    
    await this.notePersistenceQueue.add(
      'persist-note',
      data,
      { jobId }
    );
  }

  private parseRedisUrl(url: string) {
    // Parse Railway Redis URL format
    // redis://default:password@host:port
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port),
      password: urlObj.password,
      username: urlObj.username || 'default',
    };
  }
}
```

**Queue Strategy**:
- Deduplicate jobs by `noteId` + 5-second window
- Prevents duplicate DB writes for rapid edits
- Retry failed jobs with exponential backoff

---

### 6. Queue Processor (Worker)

**File**: `src/queue/processors/note-persistence.processor.ts`

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotesService } from '../../notes/notes.service';
import * as Y from 'yjs';

@Processor('note-persistence')
export class NotePersistenceProcessor extends WorkerHost {
  private logger = new Logger('NotePersistenceProcessor');

  constructor(private notesService: NotesService) {
    super();
  }

  async process(job: Job) {
    const { noteId, delta, userId, timestamp } = job.data;

    try {
      this.logger.log(`Processing persistence for note: ${noteId}`);

      // Convert delta array back to Uint8Array
      const update = new Uint8Array(delta);

      // Apply update to database
      await this.notesService.applyUpdate(noteId, update, userId);

      this.logger.log(`✅ Note ${noteId} persisted at ${new Date(timestamp).toISOString()}`);
      
      return { 
        success: true, 
        noteId, 
        timestamp,
        processingTime: Date.now() - timestamp 
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to persist note ${noteId}: ${error.message}`
      );
      throw error; // Triggers retry
    }
  }
}
```

---

### 7. Notes Service (Business Logic)

**File**: `src/notes/notes.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as Y from 'yjs';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async applyUpdate(
    noteId: string, 
    update: Uint8Array, 
    userId: string
  ) {
    // Get current note
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException(`Note ${noteId} not found`);
    }

    // Create Yjs document
    const ydoc = new Y.Doc();
    
    // Apply existing state if available
    if (note.yjsState) {
      const existingState = Buffer.from(note.yjsState, 'base64');
      Y.applyUpdate(ydoc, existingState);
    }
    
    // Apply new update
    Y.applyUpdate(ydoc, update);

    // Encode updated state
    const newState = Y.encodeStateAsUpdate(ydoc);
    const base64State = Buffer.from(newState).toString('base64');

    // Save to database
    await this.prisma.note.update({
      where: { id: noteId },
      data: {
        yjsState: base64State,
        updatedAt: new Date(),
        lastEditedBy: userId,
      },
    });

    // Check if snapshot needed
    await this.createSnapshotIfNeeded(noteId);
  }

  private async createSnapshotIfNeeded(noteId: string) {
    // Create full content snapshot every 100 updates
    const updateCount = await this.prisma.noteUpdate.count({
      where: { noteId },
    });

    if (updateCount % 100 === 0) {
      const note = await this.prisma.note.findUnique({
        where: { id: noteId },
      });

      if (note?.yjsState) {
        const ydoc = new Y.Doc();
        Y.applyUpdate(
          ydoc, 
          Buffer.from(note.yjsState, 'base64')
        );

        // Save snapshot
        await this.prisma.noteSnapshot.create({
          data: {
            noteId,
            content: ydoc.toJSON(),
            createdAt: new Date(),
          },
        });
      }
    }
  }

  async getNote(noteId: string) {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      include: {
        owner: true,
      },
    });

    if (!note) {
      throw new NotFoundException(`Note ${noteId} not found`);
    }

    // Reconstruct content from Yjs state
    let content = null;
    if (note.yjsState) {
      const ydoc = new Y.Doc();
      Y.applyUpdate(
        ydoc, 
        Buffer.from(note.yjsState, 'base64')
      );
      content = ydoc.toJSON();
    }

    return {
      id: note.id,
      title: note.title,
      content,
      yjsState: note.yjsState,
      owner: note.owner,
      updatedAt: note.updatedAt,
      createdAt: note.createdAt,
    };
  }

  async createNote(ownerId: string, title?: string) {
    return this.prisma.note.create({
      data: {
        title: title || 'Untitled',
        ownerId,
        yjsState: null,
      },
    });
  }
}
```

**Yjs State Management**:
- Store Yjs binary state as base64 in PostgreSQL
- Apply incremental updates to existing state
- Create periodic snapshots for recovery
- Reconstruct content on-demand from state

---

### 8. Prisma Schema

**File**: `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  notes     Note[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}

model Note {
  id            String         @id @default(cuid())
  title         String?
  yjsState      String?        @db.Text  // Yjs binary state (base64)
  content       Json?          // Optional: periodic snapshot
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  lastEditedBy  String?
  
  owner         User           @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  ownerId       String
  
  updates       NoteUpdate[]
  snapshots     NoteSnapshot[]
  
  @@index([ownerId])
  @@index([updatedAt])
}

model NoteUpdate {
  id        String   @id @default(cuid())
  noteId    String
  userId    String
  delta     Bytes    // Raw Yjs update
  createdAt DateTime @default(now())
  
  note      Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)
  
  @@index([noteId, createdAt])
}

model NoteSnapshot {
  id        String   @id @default(cuid())
  noteId    String
  content   Json     // Full content at snapshot time
  createdAt DateTime @default(now())
  
  note      Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)
  
  @@index([noteId, createdAt])
}
```

**Database Strategy**:
- `Note.yjsState`: Current state (incremental updates)
- `NoteUpdate`: Audit trail of all changes (optional)
- `NoteSnapshot`: Periodic full snapshots for recovery

---

### 9. Health Check

**File**: `src/health/health.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async check() {
    const checks = {
      status: 'unknown',
      timestamp: new Date().toISOString(),
      redis: false,
      database: false,
    };

    // Check Redis
    try {
      await this.redis.client.ping();
      checks.redis = true;
    } catch (e) {
      console.error('Redis health check failed:', e);
    }

    // Check Database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (e) {
      console.error('Database health check failed:', e);
    }

    checks.status = (checks.redis && checks.database) ? 'healthy' : 'degraded';

    return checks;
  }
}
```

---

## Railway Configuration

### 1. railway.toml

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run start:prod"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[healthcheck]
path = "/health"
timeout = 100
interval = 30
```

### 2. Environment Variables (Railway Dashboard)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://default:pass@host:6379

# Application
NODE_ENV=production
PORT=3000

# CORS
FRONTEND_URL=https://your-app.vercel.app
```

### 3. Package.json Scripts

```json
{
  "scripts": {
    "build": "nest build",
    "start:prod": "node dist/main",
    "start:dev": "nest start --watch",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate deploy",
    "postinstall": "prisma generate"
  }
}
```

---

## Deployment Checklist

### Vercel (Frontend)

- [ ] Set `NEXT_PUBLIC_API_URL` environment variable
- [ ] Set `NEXT_PUBLIC_SOCKET_URL` environment variable
- [ ] Add Railway URL to environment variables
- [ ] Test Socket.IO connection from preview deployment
- [ ] Verify CORS headers in browser console

### Railway (Backend)

- [ ] Create PostgreSQL database addon
- [ ] Create Redis addon
- [ ] Set all environment variables (DATABASE_URL, REDIS_URL, etc.)
- [ ] Deploy backend service
- [ ] Run `prisma migrate deploy` in Railway CLI
- [ ] Check logs for successful Redis/DB connections
- [ ] Test `/health` endpoint
- [ ] Verify WebSocket connection works
- [ ] Monitor memory/CPU usage

---

## Performance Optimization

### 1. Rate Limiting

Add rate limiting to prevent abuse:

```typescript
// guards/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const userId = client.data.userId;

    const allowed = await this.redisService.checkRateLimit(
      userId,
      50, // 50 updates per second
      1   // 1 second window
    );

    return allowed;
  }
}

// Apply to gateway
@UseGuards(RateLimitGuard)
@SubscribeMessage('note:update')
async handleNoteUpdate(...) { ... }
```

### 2. Connection Pooling

Optimize database connections:

```typescript
// prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: ['error', 'warn'],
      // Connection pooling
      // Railway PostgreSQL supports up to 22 connections
      // Reserve some for other processes
      // Recommended: instances * 5 + 5
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
```

### 3. Batch Processing

Process multiple updates together:

```typescript
// In processor
async process(job: Job) {
  const updates = job.data;
  
  // Group by noteId
  const grouped = updates.reduce((acc, update) => {
    if (!acc[update.noteId]) acc[update.noteId] = [];
    acc[update.noteId].push(update);
    return acc;
  }, {});

  // Process each note
  await Promise.all(
    Object.entries(grouped).map(([noteId, noteUpdates]) =>
      this.processNoteUpdates(noteId, noteUpdates)
    )
  );
}
```

---

## Monitoring & Debugging

### 1. Logging

Use structured logging:

```typescript
// logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class CustomLogger implements LoggerService {
  log(message: string, context?: string) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      context,
      timestamp: new Date().toISOString(),
    }));
  }

  error(message: string, trace?: string, context?: string) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      trace,
      context,
      timestamp: new Date().toISOString(),
    }));
  }

  warn(message: string, context?: string) {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      context,
      timestamp: new Date().toISOString(),
    }));
  }
}
```

### 2. Metrics

Track key metrics:

```typescript
// metrics.service.ts
@Injectable()
export class MetricsService {
  private metrics = {
    connections: 0,
    messagesProcessed: 0,
    errors: 0,
  };

  incrementConnections() {
    this.metrics.connections++;
  }

  decrementConnections() {
    this.metrics.connections--;
  }

  incrementMessages() {
    this.metrics.messagesProcessed++;
  }

  incrementErrors() {
    this.metrics.errors++;
  }

  getMetrics() {
    return this.metrics;
  }
}
```

---

## Troubleshooting

### Common Issues

**1. WebSocket not connecting from Vercel**
- Check CORS configuration
- Verify `NEXT_PUBLIC_SOCKET_URL` is set correctly
- Test with polling transport first
- Check Railway logs for connection errors

**2. Redis connection timeout**
- Verify REDIS_URL format
- Check Railway Redis addon is running
- Test connection with `redis-cli`

**3. Database connection pool exhausted**
- Reduce Prisma connection pool size
- Check for connection leaks
- Monitor active connections

**4. Messages not persisting**
- Check BullMQ queue is running
- Verify worker processor is active
- Check Railway logs for queue errors

**5. High latency**
- Monitor Redis cache hit rate
- Check database query performance
- Optimize Yjs delta size
- Consider CDN for static assets

---

## Security Considerations

### 1. Authentication

Add JWT authentication:

```typescript
// auth.guard.ts
@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const token = client.handshake.auth.token;

    try {
      const payload = await this.jwtService.verifyAsync(token);
      client.data.userId = payload.sub;
      client.data.userName = payload.name;
      return true;
    } catch {
      return false;
    }
  }
}
```

### 2. Authorization

Check note access permissions:

```typescript
@SubscribeMessage('note:join')
@UseGuards(WsAuthGuard)
async handleJoinNote(
  @MessageBody() data: { noteId: string },
  @ConnectedSocket() client: Socket,
) {
  const userId = client.data.userId;
  
  // Check if user has access to this note
  const hasAccess = await this.notesService.checkAccess(
    data.noteId,
    userId
  );
  
  if (!hasAccess) {
    throw new WsException('Unauthorized');
  }
  
  // ... rest of join logic
}
```

### 3. Input Validation

Validate all inputs:

```typescript
// dto/note-update.dto.ts
import { IsString, IsArray, ArrayMaxSize } from 'class-validator';

export class NoteUpdateDto {
  @IsString()
  noteId: string;

  @IsArray()
  @ArrayMaxSize(10000) // Prevent huge deltas
  delta: number[];

  @IsString()
  userId: string;
}
```

---

## Scaling Strategy

### Horizontal Scaling

Railway supports multiple instances:

1. **Load Balancing**: Automatic via Railway
2. **Redis Adapter**: Shares WebSocket state across instances
3. **Sticky Sessions**: Not needed with Redis adapter

### Vertical Scaling

Optimize resource usage:

- Monitor memory consumption
- Use Redis for session storage
- Implement connection limits
- Cache frequently accessed notes

---

## Testing

### Unit Tests

```typescript
// notes.gateway.spec.ts
describe('NotesGateway', () => {
  let gateway: NotesGateway;
  let redisService: RedisService;
  let queueService: QueueService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotesGateway,
        {
          provide: RedisService,
          useValue: { addUserToNote: jest.fn() },
        },
        {
          provide: QueueService,
          useValue: { addNotePersistenceJob: jest.fn() },
        },
      ],
    }).compile();

    gateway = module.get<NotesGateway>(NotesGateway);
  });

  it('should broadcast note updates', async () => {
    // Test implementation
  });
});
```

### Integration Tests

```typescript
// socket.integration.spec.ts
describe('Socket Integration', () => {
  let app: INestApplication;
  let socket: Socket;

  beforeAll(async () => {
    // Setup test app
  });

  it('should connect and join room', (done) => {
    socket.emit('note:join', {
      noteId: 'test-123',
      userId: 'user-456',
      userName: 'Test User',
    });

    socket.on('users:list', (users) => {
      expect(users).toBeDefined();
      done();
    });
  });
});
```

---

## Additional Resources

### Documentation
- Yjs: https://docs.yjs.dev/
- Tiptap: https://tiptap.dev/docs
- Socket.IO: https://socket.io/docs/v4/
- BullMQ: https://docs.bullmq.io/

### Tools
- Railway CLI: `npm i -g @railway/cli`
- Prisma Studio: `npx prisma studio`
- Redis CLI: `redis-cli -u $REDIS_URL`

---

## Summary

This architecture provides:

✅ **Real-time collaboration** via Socket.IO + Yjs  
✅ **Conflict-free editing** via CRDT  
✅ **Scalable backend** via Redis adapter  
✅ **Reliable persistence** via BullMQ queues  
✅ **Fast broadcasts** (priority-based flow)  
✅ **User presence** tracking  
✅ **Production-ready** for Railway + Vercel  

Key principles:
1. **Broadcast first** (real-time UX)
2. **Cache second** (fast recovery)
3. **Persist last** (eventual consistency)
4. **Handle failures** (retries + error handling)
5. **Monitor everything** (logs + metrics)