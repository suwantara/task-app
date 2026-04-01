# TaskFlow — Backend

NestJS 11 REST API and WebSocket server for TaskFlow. Handles authentication, all data mutations, real-time event broadcasting, and deferred note persistence via Redis.

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/core` | 11 | Framework core |
| `@nestjs/jwt` + `passport-jwt` | 11 / 4 | JWT authentication |
| `@nestjs/websockets` + `socket.io` | 11 / 4 | WebSocket gateway |
| `@nestjs/swagger` | 11 | Auto-generated Swagger docs |
| `prisma` + `@prisma/client` | 6 | Database ORM |
| `ioredis` | 5 | Redis client (cache, pub/sub, session) |
| `@socket.io/redis-adapter` | 8 | Multi-instance Socket.IO scaling |
| `bcrypt` | 6 | Password hashing |
| `class-validator` + `class-transformer` | — | Request DTO validation |
| `yjs` + `y-protocols` | — | CRDT document state (Yjs-ready gateway) |

## Module Overview

```
src/
├── main.ts                  # Bootstrap: CORS, Redis adapter, Swagger, global pipes
├── app.module.ts            # Root module
├── app.controller.ts        # GET / (ping) and GET /health
├── app.service.ts           # Health check logic (Redis + DB)
│
├── auth/                    # JWT authentication
│   ├── auth.controller.ts   # POST /auth/register, /login, /logout, GET /profile
│   ├── auth.service.ts      # bcrypt hashing, JWT sign/verify, Redis session
│   ├── strategies/          # JwtStrategy (passport-jwt)
│   └── dto/                 # LoginDto, RegisterDto
│
├── users/                   # User profile management
│   ├── users.controller.ts  # GET /users/me, PATCH /users/me, GET/PATCH /users/me/settings
│   └── users.service.ts
│
├── workspaces/              # Workspace & invite link management
│   ├── workspaces.controller.ts  # CRUD + join via short code
│   └── workspaces.service.ts     # Role checks, invite link generation
│
├── boards/                  # Kanban board CRUD
│   ├── boards.controller.ts # GET/POST /boards, PATCH/DELETE /boards/:id
│   └── boards.service.ts
│
├── columns/                 # Column CRUD + color
│   ├── columns.controller.ts # GET/POST /columns, PATCH/DELETE /columns/:id
│   └── columns.service.ts
│
├── tasks/                   # Task CRUD + move between columns
│   ├── tasks.controller.ts  # GET/POST /tasks, PATCH/DELETE /tasks/:id, POST /tasks/:id/move
│   └── tasks.service.ts
│
├── notes/                   # Collaborative notes
│   ├── notes.controller.ts  # GET/POST /notes, PATCH/DELETE /notes/:id
│   └── notes.service.ts     # Redis buffer → broadcast → deferred DB flush (10 s)
│
├── realtime/                # WebSocket layer
│   ├── realtime.gateway.ts  # Socket.IO event handlers
│   ├── realtime.service.ts  # Redis pub/sub publisher (decoupled from gateway)
│   └── redis-io.adapter.ts  # Socket.IO Redis adapter (multi-instance support)
│
├── cache/                   # @Global() Redis service
│   └── cache.service.ts     # get / set / del / publish / subscribe (ioredis)
│
├── prisma/                  # @Global() Prisma service
│   └── prisma.service.ts    # PrismaClient with onModuleInit / onModuleDestroy
│
└── common/                  # @Global() shared utilities
    ├── permissions.service.ts  # Workspace / board / note access validation
    └── decorators/             # @CurrentUser(), @Public()
```

## API Endpoints

> Full interactive docs are available at `http://localhost:3000/api` (Swagger UI) when the server is running.

| Module | Method | Path | Description |
|--------|--------|------|-------------|
| **Auth** | POST | `/auth/register` | Create a new account |
| | POST | `/auth/login` | Log in, returns JWT |
| | POST | `/auth/logout` | Invalidate Redis session |
| | GET | `/auth/profile` | Fetch authenticated user |
| **Users** | GET | `/users/me` | Get own profile |
| | PATCH | `/users/me` | Update name / avatar |
| | GET | `/users/me/settings` | Get notification settings |
| | PATCH | `/users/me/settings` | Update notification settings |
| **Workspaces** | GET | `/workspaces` | List user's workspaces |
| | POST | `/workspaces` | Create workspace |
| | PATCH | `/workspaces/:id` | Update name (owner only) |
| | DELETE | `/workspaces/:id` | Delete workspace (owner only) |
| | POST | `/workspaces/join` | Join via short invite code |
| | GET | `/workspaces/:id/members` | List members + roles |
| | PATCH | `/workspaces/:id/members/:userId` | Change member role |
| | DELETE | `/workspaces/:id/members/:userId` | Remove member |
| **Boards** | GET | `/boards?workspaceId=` | List boards in workspace |
| | POST | `/boards` | Create board |
| | PATCH | `/boards/:id` | Update board |
| | DELETE | `/boards/:id` | Delete board |
| **Columns** | GET | `/columns?boardId=` | List columns with tasks |
| | POST | `/columns` | Create column |
| | PATCH | `/columns/:id` | Update title / color |
| | DELETE | `/columns/:id` | Delete column |
| **Tasks** | GET | `/tasks?columnId=` | List tasks |
| | POST | `/tasks` | Create task |
| | PATCH | `/tasks/:id` | Update task fields |
| | DELETE | `/tasks/:id` | Delete task |
| | POST | `/tasks/:id/move` | Move to another column + reorder |
| **Notes** | GET | `/notes?workspaceId=` | List notes |
| | POST | `/notes` | Create note |
| | PATCH | `/notes/:id` | Update content (triggers realtime broadcast) |
| | DELETE | `/notes/:id` | Delete note |
| **Health** | GET | `/health` | Redis + DB connectivity check |

## WebSocket Events

The `RealtimeGateway` uses Socket.IO rooms. Clients join rooms by emitting `joinRoom` with a room name (e.g., `board:uuid`, `workspace:uuid`).

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `joinRoom` | `{ room, userId, name, avatarUrl, page }` | Join a room and broadcast presence |
| `leaveRoom` | `{ room }` | Leave room, update presence |
| `note:typing` | `{ noteId, workspaceId, userId, userName }` | Broadcast typing indicator |
| `note:stop-typing` | `{ noteId, workspaceId, userId }` | Clear typing indicator |
| `task:move` | `{ taskId, targetColumnId, boardId }` | Optimistic drag/drop broadcast |
| `cursor:move` | `{ boardId, userId, x, y }` | Live cursor position |
| `presence:update-page` | `{ room, page }` | Update current page for presence |
| `yjs:join` | `{ docId, userId }` | Join a Yjs CRDT document room |
| `yjs:update` | `{ docId, update: Uint8Array }` | Broadcast Yjs document update |
| `yjs:awareness` | `{ docId, awareness }` | Broadcast cursor/awareness state |

### Server → Client

| Event | Description |
|-------|-------------|
| `presence:update` | Updated online users list for the room |
| `task:created` / `task:updated` / `task:deleted` / `task:moved` | Board task changes |
| `column:created` / `column:updated` | Board column changes |
| `note:created` / `note:updated` / `note:deleted` | Note content changes |
| `note:typing` / `note:stop-typing` | Typing indicators |
| `cursor:update` | Cursor positions |
| `yjs:update` / `yjs:awareness` | CRDT document sync |

## Notes Deferred Persistence

`NotesService.update()` follows a four-step write path to balance safety, speed, and database load:

1. **Redis buffer write** (`doc_buffer:{noteId}`, TTL 10 min) — crash-safe, in-memory merge
2. **Redis cache update** (`note:{noteId}`) — fast subsequent reads
3. **Immediate broadcast** — `RealtimeService` publishes to `workspace:{workspaceId}` Redis channel; gateway relays to all Socket.IO clients (P50 ~10–50 ms)
4. **Deferred DB flush** — `setTimeout(10 s)` that resets on each write; rapid edits coalesce into a single PostgreSQL write. `OnModuleDestroy` flushes all pending buffers on graceful shutdown.

## Environment Variables

Create `apps/backend/.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/task-manager

# JWT (generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=your_very_long_random_secret_here

# Server
PORT=3000
FRONTEND_URL=http://localhost:3001

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=

# Optional: Redis URL takes precedence over HOST/PORT/PASSWORD
# REDIS_URL=redis://:password@host:port
```

## Running Locally

```bash
# From monorepo root — start PostgreSQL + Redis
docker-compose up -d

# Install dependencies (from root)
npm install

# Run migrations
cd apps/backend
npx prisma migrate dev

# Start in watch mode
npm run start:dev
# API: http://localhost:3000
# Swagger: http://localhost:3000/api
```

## Testing

```bash
cd apps/backend

npm test              # Unit tests (Jest)
npm run test:watch    # Watch mode
npm run test:cov      # Coverage report
npm run test:e2e      # End-to-end tests (requires running DB)
```

Unit tests are co-located as `*.spec.ts` files. E2E tests live in `test/app.e2e-spec.ts`.

## Database

Schema is defined in `prisma/schema.prisma`. Key models:

```
User ──< WorkspaceMember >── Workspace ──< Board ──< Column ──< Task
 │                                │                               │
 └── UserSettings                 ├── Note                  Label ┘
                                  └── WorkspaceInviteLink
```

```bash
npx prisma migrate dev          # Create & apply new migration
npx prisma migrate deploy       # Apply existing migrations (production)
npx prisma generate             # Regenerate Prisma Client after schema change
npx prisma studio               # Visual DB browser at http://localhost:5555
```

