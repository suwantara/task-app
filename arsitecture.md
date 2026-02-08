# Real-Time Collaborative Task & Notes App — Architecture

## Overview

Arsitektur lengkap untuk aplikasi task management dan collaborative notes dengan real-time synchronization:

- **Frontend**: Next.js 15 (App Router, deployed on Vercel)
- **Backend**: NestJS (deployed on Railway)
- **Database**: PostgreSQL 15 (Railway / Docker)
- **Cache / Pub-Sub**: Redis 7 (Railway / Docker)
- **Real-time**: Socket.IO with Redis Adapter
- **Editor**: Tiptap with Yjs CRDT support
- **State Management**: TanStack Query v5
- **ORM**: Prisma
- **Monorepo**: npm workspaces (`apps/backend`, `apps/frontend`, `packages/shared-types`)

---

## Architecture Diagram

```
┌───────────────────────────────────────────────────────┐
│  VERCEL (Next.js Frontend)                            │
│  ├─ React Components (App Router)                     │
│  ├─ Tiptap Editor (HTML autosave + Yjs ready)         │
│  ├─ TanStack Query v5 (REST API calls + cache)        │
│  ├─ SocketProvider (Socket.IO client, auto-reconnect) │
│  └─ Hooks: useBoardRealtime / useNoteRealtime         │
└───────────────┬───────────────────────────────────────┘
                │
                │ REST API (HTTP/HTTPS)
                │ WebSocket (Socket.IO)
                ↓
┌────────────────────────────────────────────────────────┐
│  RAILWAY (NestJS Backend)                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │  REST API (Controllers)                          │  │
│  │  • Auth   (JWT login/register)                   │  │
│  │  • Users  • Workspaces  • Boards                 │  │
│  │  • Columns  • Tasks  • Notes                     │  │
│  │  • GET /health (Redis + DB checks)               │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  RealtimeGateway (Socket.IO)                     │  │
│  │  • joinRoom / leaveRoom (generic rooms)          │  │
│  │  • note:typing / note:stop-typing                │  │
│  │  • cursor:move / task:move                       │  │
│  │  • presence:update-page                          │  │
│  │  • yjs:join / yjs:update / yjs:awareness         │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  RealtimeService (Redis Pub/Sub Publisher)        │  │
│  │  • Decoupled from Socket.IO — services publish,  │  │
│  │    gateway subscribes & relays to clients         │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  NotesService (Deferred Persistence)             │  │
│  │  • Redis buffer write (crash-safe)               │  │
│  │  • Immediate broadcast (fast path)               │  │
│  │  • Deferred DB flush (10s setTimeout, batched)   │  │
│  │  • OnModuleDestroy: flush all pending buffers    │  │
│  └──────────────────────────────────────────────────┘  │
└──────┬──────────────────────┬─────────────────────────┘
       │                      │
       ↓                      ↓
┌──────────────┐       ┌─────────────────┐
│    REDIS     │       │   POSTGRESQL    │
│              │       │                 │
│ • Cache      │       │ • Users         │
│ • Presence   │       │ • Workspaces    │
│ • Pub/Sub    │       │ • Boards        │
│ • Doc Buffer │       │ • Tasks/Columns │
│ • Yjs State  │       │ • Notes         │
│ • Socket.IO  │       │ • Labels        │
│   Adapter    │       │ • Settings      │
└──────────────┘       └─────────────────┘
```

---

## Data Flow

### Notes Real-Time Update Flow

```
User types in Tiptap Editor (Frontend)
    ↓
handleContentChange → setEditingContent + emit 'note:typing'
    ↓
scheduleAutosave (2s debounce)
    ↓
handleSaveNote → PATCH /notes/:id (REST API)
    ↓
Backend NotesService.update() receives request
    ↓
┌──────────────────────────────────────────────┐
│ STEP 1: REDIS BUFFER (crash-safe)            │
│ Merge update with existing buffer in Redis   │
│ Key: doc_buffer:{noteId}, TTL: 10 min        │
│ Latency: ~5ms                                │
└──────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────┐
│ STEP 2: OPTIMISTIC CACHE UPDATE              │
│ Update note read-cache in Redis              │
│ Key: note:{noteId}                           │
│ Latency: ~5ms                                │
└──────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────┐
│ STEP 3: IMMEDIATE BROADCAST (Priority)       │
│ RealtimeService publishes 'note:updated'     │
│ to workspace:{workspaceId} Redis channel     │
│ Gateway relays to all Socket.IO clients      │
│ Latency: ~10-50ms                            │
└──────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────┐
│ STEP 4: DEFERRED DB FLUSH                    │
│ setTimeout 10 seconds (resets on each call)  │
│ Rapid edits batch into one DB write          │
│ OnModuleDestroy flushes all pending buffers  │
└──────────────────────────────────────────────┘
```

### Board Real-Time Update Flow

```
User creates/updates/deletes task or column
    ↓
REST API mutation (TanStack Query)
    ↓
Service writes to PostgreSQL directly
    ↓
RealtimeService publishes event to Redis channel 'board:{boardId}'
    ↓
RealtimeGateway receives via psubscribe('board:*')
    ↓
Gateway emits to Socket.IO room → all clients update cache via callbacks
```

### Why This Order? (Notes)

1. **Redis Buffer First**: Crash-safe — data survives if process restarts before DB flush
2. **Broadcast Second**: Users see changes immediately (real-time feel)
3. **Database Last**: Eventual consistency — batched writes reduce DB load

---

## Frontend Implementation (Vercel — Next.js)

### 1. Socket Context & Provider

**File**: `src/contexts/socket-context.tsx`

```typescript
// Singleton Socket.IO connection per authenticated user
const newSocket = io(SOCKET_URL, {
  auth: { token },
  transports: ['websocket'],  // WebSocket only (no polling fallback)
});

// Auto-join/leave rooms via context methods
joinRoom(room)   // emits 'joinRoom' with user presence data
leaveRoom(room)  // emits 'leaveRoom'

// Presence tracking
socket.on('presence:update', (data) => setOnlineUsers(data.users));
```

**Key Points**:
- Socket created on auth → disposed on logout
- `joinRoom` sends user metadata (name, avatar, current page)
- Presence updates pushed from server on join/leave
- `useSocket()` hook provides `{ socket, joinRoom, leaveRoom, onlineUsers }`

---

### 2. Realtime Hooks

**File**: `src/hooks/use-realtime.ts`

```typescript
// Board realtime: auto-joins board:{boardId} room
export function useBoardRealtime(boardId, callbacks) {
  // Listens: task:created, task:updated, task:deleted, task:moved,
  //          column:created, column:updated, cursor:update
  return { emitTaskMove };
}

// Note realtime: auto-joins workspace:{workspaceId} room
export function useNoteRealtime(workspaceId, callbacks) {
  // Listens: note:created, note:updated, note:deleted,
  //          note:typing, note:stop-typing
  return { emitTyping, emitStopTyping };
}
```

**Key Concepts**:
- Hooks auto-join/leave rooms based on prop changes
- Callbacks update TanStack Query cache directly (no refetch)
- Typing indicators: emit `note:typing` on keystroke, `note:stop-typing` on save
- `emitTaskMove` broadcasts optimistic drag-drop to other clients

---

### 3. Notes Page (Autosave Architecture)

**File**: `src/app/(app)/notes/page.tsx`

```typescript
// Stale-closure avoidance pattern: refs always hold latest values
const editingContentRef = useRef(editingContent);
editingContentRef.current = editingContent;
const editingTitleRef = useRef(editingTitle);
editingTitleRef.current = editingTitle;

// Autosave: 2-second debounce after last keystroke
const AUTOSAVE_INTERVAL = 2000;

handleContentChange → setEditingContent() + emit typing + scheduleAutosave()
scheduleAutosave   → clearTimeout + setTimeout(handleSaveNote, 2000)
handleSaveNote     → reads from refs (not closure) → mutateAsync → emitStopTyping

// Remote updates: onNoteUpdated callback
// Skip if isLocalEdit.current === true (avoid echoing own changes)
// Otherwise update selectedNote, editingTitle, editingContent

// Typing indicator: Map<userId, name> with 3-second auto-clear
```

**Save Status UI**:
- `saving` → Loader2 spinner + "Saving"
- `saved` → Check icon + "Saved" (green, auto-clears after 2s)
- `unsaved` → Dot indicator

---

### 4. Tiptap Editor (Yjs-Ready)

**File**: `src/components/tiptap-templates/simple/simple-editor.tsx`

```typescript
interface SimpleEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  // Optional Yjs collaboration props
  ydoc?: Y.Doc;
  awareness?: Awareness;
  user?: { name: string; color: string };
}

// Conditionally includes Collaboration + CollaborationCursor extensions
// When ydoc is NOT provided → uses HTML content mode (current notes page)
// When ydoc IS provided → uses CRDT mode (history disabled, cursor sharing)
```

**Current State**: Notes page uses HTML autosave mode (no Yjs props passed). Yjs integration is available in the gateway and editor for future use.

---

### 5. Environment Variables

```bash
# .env.local (Vercel)
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_WS_URL=https://your-backend.railway.app
```

---

## Backend Implementation (Railway — NestJS)

### Project Structure

```
apps/backend/src/
├── main.ts                        # Bootstrap: CORS, Redis adapter, Swagger
├── app.module.ts                  # Root module
├── app.controller.ts              # GET / and GET /health
├── app.service.ts                 # Health check logic (Redis + DB)
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts         # POST /auth/login, /auth/register
│   ├── auth.service.ts            # JWT + bcrypt
│   ├── dto/                       # LoginDto, RegisterDto
│   └── strategies/                # JwtStrategy
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts        # User profile + settings
│   └── users.service.ts
├── workspaces/
│   ├── workspaces.module.ts
│   ├── workspaces.controller.ts   # CRUD + join codes + invite links
│   └── workspaces.service.ts
├── boards/
│   ├── boards.module.ts
│   ├── boards.controller.ts       # CRUD boards
│   └── boards.service.ts
├── columns/
│   ├── columns.module.ts
│   ├── columns.controller.ts      # CRUD + reorder columns
│   └── columns.service.ts
├── tasks/
│   ├── tasks.module.ts
│   ├── tasks.controller.ts        # CRUD + move tasks
│   └── tasks.service.ts
├── notes/
│   ├── notes.module.ts
│   ├── notes.controller.ts        # CRUD notes
│   ├── notes.service.ts           # Redis buffer + deferred DB flush
│   └── dto/                       # CreateNoteDto, UpdateNoteDto
├── realtime/
│   ├── realtime.module.ts
│   ├── realtime.gateway.ts        # Socket.IO gateway (all WS events)
│   ├── realtime.service.ts        # Redis pub/sub publisher
│   └── redis-io.adapter.ts        # Socket.IO Redis adapter
├── cache/
│   ├── cache.module.ts            # @Global()
│   └── cache.service.ts           # Redis wrapper (ioredis)
├── prisma/
│   ├── prisma.module.ts           # @Global()
│   └── prisma.service.ts          # PrismaClient
└── common/
    ├── common.module.ts           # @Global()
    ├── permissions.service.ts     # Workspace/Board/Note access validation
    └── decorators/                # @CurrentUser, @Public
```

---

### 1. Main Bootstrap

**File**: `src/main.ts`

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS (allow all origins for dev, configure for prod)
  app.enableCors({ origin: true, credentials: true });

  // Redis adapter for Socket.IO (multi-instance scaling)
  if (process.env.REDIS_URL) {
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  }

  // Global validation (whitelist + transform)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger at /api
  SwaggerModule.setup('api', app, document);

  await app.listen(port, '0.0.0.0'); // 0.0.0.0 for Railway/Docker
}
```

---

### 2. Redis Adapter (Multi-Instance Socket.IO)

**File**: `src/realtime/redis-io.adapter.ts`

```typescript
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis(redisUrl, {
      retryStrategy: (times) => times > 3 ? null : Math.min(times * 200, 2000),
      lazyConnect: true,
    });
    await pubClient.connect();
    const subClient = pubClient.duplicate();
    await subClient.connect();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port, options) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;  // Falls back to in-memory if Redis fails
  }
}
```

**Why This Matters**:
- Enables horizontal scaling (multiple Railway instances)
- Socket.IO messages broadcast across all servers via Redis pub/sub
- Graceful fallback to in-memory if Redis is unavailable

---

### 3. RealtimeGateway (Socket.IO Events)

**File**: `src/realtime/realtime.gateway.ts`

```typescript
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {

  // On init: subscribe to Redis pub/sub channels
  async afterInit() {
    await this.cache.psubscribe('board:*', (channel, msg) => {
      this.server.to(channel).emit(msg.event, msg.data);
    });
    await this.cache.psubscribe('workspace:*', (channel, msg) => {
      this.server.to(channel).emit(msg.event, msg.data);
    });
  }

  // Generic room management with presence tracking (Redis hash)
  @SubscribeMessage('joinRoom')  → join room + store presence in Redis
  @SubscribeMessage('leaveRoom') → leave room + remove presence

  // Ephemeral events (no persistence)
  @SubscribeMessage('cursor:move')         → broadcast cursor to room
  @SubscribeMessage('task:move')            → broadcast drag-drop to room
  @SubscribeMessage('note:typing')          → broadcast typing indicator
  @SubscribeMessage('note:stop-typing')     → broadcast stop-typing
  @SubscribeMessage('presence:update-page') → update user's current page

  // Yjs Collaborative Editing (state stored in Redis binary buffer)
  @SubscribeMessage('yjs:join')      → join yjs room, send current doc state
  @SubscribeMessage('yjs:update')    → merge update into Redis, broadcast delta
  @SubscribeMessage('yjs:awareness') → relay cursor/selection awareness
  @SubscribeMessage('yjs:leave')     → leave yjs room, cleanup tracking
}
```

**Event Summary**:

| Event | Direction | Description |
|---|---|---|
| `joinRoom` | Client → Server | Join Socket.IO room + register presence |
| `leaveRoom` | Client → Server | Leave room + remove presence |
| `presence:update` | Server → Client | Updated presence list for room |
| `note:typing` | Client ↔ Server | Typing indicator (no content) |
| `note:stop-typing` | Client ↔ Server | Stop typing indicator |
| `note:created` | Server → Client | New note created (via pub/sub) |
| `note:updated` | Server → Client | Note content updated (via pub/sub) |
| `note:deleted` | Server → Client | Note deleted (via pub/sub) |
| `task:created` | Server → Client | Task CRUD events (via pub/sub) |
| `task:updated` | Server → Client | |
| `task:deleted` | Server → Client | |
| `task:move` | Client → Server | Optimistic drag-drop broadcast |
| `task:moved` | Server → Client | |
| `column:created` | Server → Client | Column events (via pub/sub) |
| `column:updated` | Server → Client | |
| `cursor:move` | Client → Server | Cursor position on board |
| `cursor:update` | Server → Client | |
| `yjs:join` | Client → Server | Join Yjs collaboration room |
| `yjs:sync` | Server → Client | Initial doc state from Redis |
| `yjs:update` | Client ↔ Server | Yjs delta broadcast |
| `yjs:awareness` | Client ↔ Server | Cursor/selection awareness |
| `yjs:leave` | Client → Server | Leave Yjs room |

---

### 4. RealtimeService (Pub/Sub Publisher)

**File**: `src/realtime/realtime.service.ts`

```typescript
@Injectable()
export class RealtimeService {
  constructor(private readonly cache: CacheService) {}

  // Board events → channel: board:{boardId}
  emitTaskCreated(boardId, task)     → cache.publish('board:{id}', { event, data })
  emitTaskUpdated(boardId, task)
  emitTaskDeleted(boardId, taskId)
  emitColumnCreated(boardId, column)
  emitColumnUpdated(boardId, column)

  // Note events → channel: workspace:{workspaceId}
  emitNoteCreated(workspaceId, note)
  emitNoteUpdated(workspaceId, note)
  emitNoteDeleted(workspaceId, noteId)

  // Presence
  emitPresenceUpdate(room, data)
}
```

**Design Principle**: Services only publish to Redis channels — they never import Socket.IO. The gateway subscribes and relays. This decoupling enables:
- Cross-instance event propagation
- Easy testing (mock CacheService)
- Clean separation of business logic and transport

---

### 5. NotesService (Deferred Persistence)

**File**: `src/notes/notes.service.ts`

```typescript
@Injectable()
export class NotesService implements OnModuleDestroy {
  private readonly dbFlushTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly DB_FLUSH_DELAY = 10_000; // 10 seconds

  // Graceful shutdown: flush all pending buffers
  async onModuleDestroy() {
    for (const [noteId, timer] of this.dbFlushTimers) {
      clearTimeout(timer);
      await this.flushToDatabase(noteId);
    }
  }

  async update(id, userId, dto) {
    // 1. Merge with Redis buffer (crash-safe)
    const bufferKey = `doc_buffer:${id}`;
    const merged = { ...existingBuffer, ...dto, workspaceId };
    await cache.set(bufferKey, merged, 600); // 10 min TTL

    // 2. Update optimistic read-cache
    await cache.set(`note:${id}`, optimistic);

    // 3. Broadcast immediately via pub/sub
    realtime.emitNoteUpdated(workspaceId, { id, ...dto, updatedAt: now });

    // 4. Schedule deferred DB write (resets timer on rapid edits)
    this.scheduleDatabaseFlush(id, workspaceId);
  }

  async findOne(id, userId) {
    // Merge DB data with pending Redis buffer
    const buffer = await cache.get(`doc_buffer:${id}`);
    return buffer ? { ...dbNote, ...buffer } : dbNote;
  }

  private async flushToDatabase(noteId) {
    // Read buffer → Prisma update → clear buffer → invalidate list cache
  }
}
```

**Key Design Decisions**:
- `setTimeout` (not BullMQ) — simpler, sufficient for single-instance deployments
- Timer resets on each call → rapid edits batch into one DB write
- `findOne` merges Redis buffer with DB data → always returns latest
- `OnModuleDestroy` ensures no data loss on shutdown

---

### 6. CacheService (Redis Wrapper)

**File**: `src/cache/cache.service.ts`

```typescript
@Global() @Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;          // ioredis main client
  private subClient: Redis;       // Dedicated subscriber client
  private prefix = 'task-app:';   // Key namespace
  private defaultTTL = 300;       // 5 minutes

  // Basic cache
  get<T>(key)                → JSON parse from Redis
  set(key, value, ttl?)      → JSON serialize to Redis with TTL
  del(key)                   → Delete key
  delPattern(pattern)        → Delete by glob pattern (SCAN + DEL)
  getOrSet<T>(key, factory)  → Cache-aside pattern

  // Pub/Sub
  publish(channel, data)     → Publish JSON to prefixed channel
  psubscribe(pattern, handler) → Pattern subscribe (e.g., 'board:*')

  // Hash (used for presence)
  hset(key, field, value)    → Set hash field
  hdel(key, field)           → Delete hash field
  hgetall(key)               → Get all hash fields

  // Sets (used for room tracking)
  sadd(key, member)          → Add to set
  srem(key, member)          → Remove from set
  smembers(key)              → Get all set members

  // Binary (used for Yjs state)
  setBuffer(key, buffer, ttl?) → Store raw binary
  getBuffer(key)               → Retrieve raw binary

  // Health
  ping()                     → Redis PING
}
```

**Redis Key Patterns**:

| Key Pattern | Type | Purpose | TTL |
|---|---|---|---|
| `task-app:notes:workspace:{id}` | String (JSON) | Notes list cache | 5 min |
| `task-app:note:{id}` | String (JSON) | Single note cache | 5 min |
| `task-app:doc_buffer:{id}` | String (JSON) | Pending note update buffer | 10 min |
| `task-app:presence:{room}` | Hash | Active users in room | — |
| `task-app:socket:rooms:{socketId}` | Set | Rooms a socket has joined | — |
| `task-app:yjs:doc:{noteId}` | Buffer | Yjs binary document state | 24 hr |
| `task-app:board:*` | Pub/Sub channel | Board events | — |
| `task-app:workspace:*` | Pub/Sub channel | Note/workspace events | — |

---

### 7. Health Check

**File**: `src/app.controller.ts` + `src/app.service.ts`

```typescript
@Get('health')
async healthCheck() {
  return {
    status: 'healthy' | 'degraded',
    timestamp: ISO string,
    redis: boolean,     // cache.ping() === 'PONG'
    database: boolean,  // prisma.$queryRaw`SELECT 1`
  };
}
```

---

### 8. Prisma Schema

**File**: `prisma/schema.prisma`

```prisma
// Users & Authentication
model User {
  id, email, passwordHash, name, avatarUrl, timestamps
  → ownedWorkspaces, workspaceMemberships, createdBoards,
    createdTasks, assignedTasks, createdNotes, settings, inviteLinks
}

model UserSettings {
  id, userId, language, timezone
  emailNotifications, pushNotifications, realtimeNotifications
}

// Workspaces
model Workspace {
  id, name, ownerId, editorJoinCode, viewerJoinCode, timestamps
  → owner, members[], inviteLinks[], boards[], tasks[], labels[], notes[]
}

model WorkspaceMember { id, workspaceId, userId, role (OWNER|EDITOR|VIEWER) }
model WorkspaceInviteLink { id, workspaceId, token, role, isActive, expiresAt, maxUses, useCount }

// Kanban Boards
model Board { id, workspaceId, name, description, creatorId → columns[], tasks[] }
model Column { id, boardId, name, position → tasks[] }

// Tasks
model Task {
  id, workspaceId, boardId, columnId, title, description
  priority (LOW|MEDIUM|HIGH), dueDate, position
  creatorId, assigneeId → labels[]
}

model Label { id, workspaceId, name, color → tasks[] }

// Notes
model Note {
  id, workspaceId, parentId, title
  content (Json — Tiptap JSON),
  icon, coverImage, creatorId, timestamps
  → parent (self-relation), children[]
}
```

**Key Design**:
- Notes use `Json` type for Tiptap content (flexible rich-text storage)
- Self-referencing `Note.parentId` enables nested/hierarchical notes
- `MemberRole` enum controls workspace-level permissions (OWNER/EDITOR/VIEWER)
- Yjs document state stored in Redis (not PostgreSQL) — ephemeral, 24h TTL

---

## Permissions & Authorization

**File**: `src/common/permissions.service.ts`

```
validateWorkspaceAccess(userId, workspaceId) → checks WorkspaceMember
validateBoardAccess(userId, boardId)         → checks board → workspace member
validateNoteAccess(userId, noteId)           → checks note → workspace member
```

All validators throw `ForbiddenException` or `NotFoundException`. Used by every service before data operations.

---

## Docker Development Setup

**File**: `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:15-alpine
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
    ports: ["6380:6379"]
```

---

## Railway Configuration

### railway.toml (recommended)

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

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://default:pass@host:6379

# Application
NODE_ENV=production
PORT=3000

# JWT
JWT_SECRET=your-secret-key
```

---

## Performance Characteristics

### Latency Profile

| Operation | Expected Latency | Notes |
|---|---|---|
| Note edit → other users see it | ~50-100ms | REST → Redis buffer → pub/sub → Socket.IO |
| Typing indicator appears | ~20-50ms | Direct Socket.IO event (no persistence) |
| Note persisted to DB | ~10s (batched) | Deferred flush, resets on rapid edits |
| Board task move broadcast | ~20-50ms | Direct Socket.IO event + pub/sub |
| Task CRUD → other users see it | ~100-200ms | REST → DB → pub/sub → Socket.IO |

### Scaling

| Component | Strategy |
|---|---|
| Socket.IO | Redis adapter → multiple Railway instances share state |
| REST API | Stateless → horizontal scaling via Railway |
| Database | Connection pooling via Prisma, Railway PostgreSQL |
| Cache | Single Redis instance, key namespacing |
| Notes persistence | Per-instance `setTimeout` (upgrade to BullMQ for multi-instance) |

---

## Security

### Authentication
- **REST**: JWT Bearer token in `Authorization` header
- **WebSocket**: JWT token in `socket.handshake.auth.token`
- Passwords hashed with bcrypt

### Authorization
- `PermissionsService` validates workspace/board/note access
- Role-based: OWNER (full), EDITOR (read/write), VIEWER (read-only)
- Global `@UseGuards(JwtAuthGuard)` on controllers + `@Public()` decorator for open routes

### Input Validation
- Global `ValidationPipe` with `whitelist: true` strips unknown properties
- DTOs with `class-validator` decorators for all endpoints

---

## Testing

### Backend Tests

```bash
npm run test        # 18 unit test suites
npm run test:e2e    # End-to-end tests
```

All services mock `PrismaService`, `CacheService`, `RealtimeService`:

```typescript
const module = await Test.createTestingModule({
  providers: [
    NotesService,
    { provide: PrismaService, useValue: mockPrisma },
    { provide: CacheService, useValue: mockCache },
    { provide: RealtimeService, useValue: mockRealtime },
    { provide: PermissionsService, useValue: mockPermissions },
  ],
}).compile();
```

---

## Troubleshooting

### Common Issues

**1. WebSocket not connecting from Vercel**
- Check `NEXT_PUBLIC_WS_URL` is set correctly
- Verify CORS allows your Vercel domain
- Check Railway logs for connection errors

**2. Notes not syncing between users**
- Verify Redis is running (`GET /health` shows `redis: true`)
- Check browser console for Socket.IO connection status
- Ensure both users joined the same `workspace:{id}` room

**3. Redis connection timeout**
- Verify `REDIS_URL` format and credentials
- Check Docker Redis container is running on port 6380
- RedisIoAdapter falls back to in-memory if Redis is unavailable

**4. Stale data after editing**
- `findOne` merges Redis buffer with DB — should always return latest
- If TanStack Query shows old data, check `onNoteUpdated` callback is wired
- `useUpdateNote` does NOT call `invalidateQueries` (realtime handles sync)

**5. Data loss on server restart**
- `OnModuleDestroy` flushes all pending buffers before shutdown
- For forced kills, Redis buffer survives (10 min TTL) — next `findOne` merges it
- Graceful shutdown: ensure Railway sends `SIGTERM` (not `SIGKILL`)

---

## Future Improvements

- [ ] **BullMQ job queue**: Replace `setTimeout` with BullMQ for multi-instance deployments
- [ ] **Yjs in notes page**: Pass `ydoc`/`awareness` to SimpleEditor for true CRDT collaboration
- [ ] **Rate limiting guard**: WebSocket rate limiter for high-frequency events
- [ ] **NoteUpdate audit trail**: Prisma model to track all note changes
- [ ] **NoteSnapshot**: Periodic full-content snapshots for recovery
- [ ] **WebSocket auth guard**: Validate JWT on every `@SubscribeMessage` handler
- [ ] **Metrics endpoint**: Connection count, messages/sec, queue depth

---

## Summary

This architecture provides:

- **Real-time collaboration** via Socket.IO + Redis pub/sub (decoupled)
- **Fast note updates** via Redis buffer → immediate broadcast → deferred DB
- **Typing indicators** without content leakage (status-only events)
- **Scalable transport** via Redis adapter for Socket.IO
- **Yjs CRDT support** ready in gateway and editor (not yet wired in notes page)
- **Health monitoring** via `/health` endpoint (Redis + DB checks)
- **Production-ready** for Railway (Vercel frontend) + Docker (local dev)
- **Clean separation**: Services → pub/sub → Gateway → Clients

Key principles:
1. **Buffer first** (crash-safe Redis)
2. **Broadcast second** (real-time UX)
3. **Persist last** (eventual consistency, batched writes)
4. **Decouple transport** (services don't know about Socket.IO)
5. **Graceful degradation** (Redis fallback, OnModuleDestroy flush)
