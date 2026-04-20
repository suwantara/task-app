# TaskFlow

> Open-source, real-time collaborative task management app built with NestJS, Next.js, PostgreSQL, Redis, and Docker.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

TaskFlow is a **self-hostable**, open-source Kanban and notes app that brings real-time collaboration to your team — think Trello meets Notion, but you own the data.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Testing](#testing)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Workspaces** — organize teams with role-based access (Owner / Editor / Viewer)
- **Kanban Boards** — drag-and-drop columns & cards with column color coding
- **Real-time Collaboration** — instant updates via Socket.IO + Redis pub/sub
- **Rich Notes** — Tiptap-powered editor with autosave (2 s debounce), typing indicators, and Yjs CRDT-ready
- **Single-Session Auth** — JWT + Redis session enforcement (one active device per user)
- **Invite Links** — short-code workspace invitations with role & expiry control
- **Calendar View** — visualize tasks by due date
- **Presence Indicators** — see who is online and on which page in real-time
- **Dark Mode** — system-aware theme switching via `next-themes`
- **Swagger API Docs** — auto-generated interactive docs at `/api`
- **Health Check** — `GET /health` endpoint verifying Redis + DB connectivity

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, TanStack Query v5, Socket.IO Client 4 |
| Backend | NestJS 11, Prisma 6, Passport-JWT, Socket.IO 4, class-validator, class-transformer |
| Database | PostgreSQL 15 |
| Cache & Pub/Sub | Redis 7 (ioredis 5, @socket.io/redis-adapter) |
| Real-time Editor | Tiptap 3 (with Yjs / y-prosemirror CRDT support) |
| Shared | TypeScript monorepo via npm workspaces (`packages/shared-types`) |
| Containerization | Docker (multi-stage build), Docker Compose |
| Deploy | Vercel (frontend) · Railway (backend) · Neon (database) · Upstash (Redis) |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  VERCEL (Next.js Frontend)                               │
│  ├─ App Router pages & React Server Components           │
│  ├─ Tiptap editor (HTML autosave + Yjs CRDT-ready)       │
│  ├─ TanStack Query v5 (REST caching & mutations)         │
│  ├─ SocketProvider (Socket.IO client, auto-reconnect)    │
│  └─ Hooks: useBoardRealtime / useNoteRealtime            │
└─────────────────┬────────────────────────────────────────┘
                  │  REST (HTTP/HTTPS) + WebSocket (Socket.IO)
                  ↓
┌──────────────────────────────────────────────────────────┐
│  RAILWAY (NestJS Backend)                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │  REST Controllers                                  │  │
│  │  Auth · Users · Workspaces · Boards                │  │
│  │  Columns · Tasks · Notes · Health                  │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  RealtimeGateway (Socket.IO)                       │  │
│  │  joinRoom · leaveRoom · note:typing                │  │
│  │  task:move · cursor:move · presence:update-page    │  │
│  │  yjs:join · yjs:update · yjs:awareness             │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  NotesService — Deferred Persistence               │  │
│  │  Redis buffer → broadcast → DB flush (10 s batch)  │  │
│  └────────────────────────────────────────────────────┘  │
└──────┬────────────────────────┬────────────────────────-─┘
       ↓                        ↓
┌─────────────┐          ┌─────────────────┐
│   REDIS 7   │          │  POSTGRESQL 15  │
│ Cache       │          │ Users           │
│ Presence    │          │ Workspaces      │
│ Pub/Sub     │          │ Boards/Columns  │
│ Doc Buffer  │          │ Tasks / Notes   │
│ Socket.IO   │          │ Labels          │
│ Adapter     │          │ Settings        │
└─────────────┘          └─────────────────┘
```

### Notes Real-Time Write Path

```
User types → Tiptap onChange (2 s debounce)
  → PATCH /notes/:id
  → [1] Redis buffer write  (crash-safe, TTL 10 min)
  → [2] Redis cache update  (fast read path)
  → [3] Broadcast via Redis pub/sub → Socket.IO → all clients
  → [4] PostgreSQL flush    (10 s batched, reset on each write)
```

### Board Real-Time Update Path

```
REST mutation → PostgreSQL write
  → RealtimeService publishes to Redis channel board:{boardId}
  → RealtimeGateway psubscribes → emits to Socket.IO room
  → All clients update TanStack Query cache via callbacks (no re-fetch)
```

## Project Structure

```
task-app/
├── apps/
│   ├── backend/                  # NestJS REST API + WebSocket gateway
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Database schema
│   │   │   └── migrations/       # Prisma migration history
│   │   └── src/
│   │       ├── auth/             # JWT login/register, Passport strategy
│   │       ├── boards/           # Board CRUD
│   │       ├── columns/          # Column CRUD + color theming
│   │       ├── tasks/            # Task CRUD + move between columns
│   │       ├── notes/            # Notes CRUD + deferred persistence
│   │       ├── workspaces/       # Workspace CRUD + invite link system
│   │       ├── users/            # User profile + settings
│   │       ├── realtime/         # Socket.IO gateway + Redis adapter
│   │       ├── cache/            # Global Redis service (ioredis)
│   │       ├── prisma/           # Global Prisma service
│   │       └── common/           # Permissions guard, decorators
│   └── frontend/                 # Next.js 16 App Router
│       └── src/
│           ├── app/              # Pages & layouts
│           ├── components/       # shadcn/ui + custom components
│           ├── contexts/         # Auth, Socket.IO, Theme providers
│           ├── hooks/            # TanStack Query + realtime hooks
│           └── lib/              # API client, utilities
├── packages/
│   └── shared-types/             # Shared enums, interfaces, event names
├── docker-compose.yml            # PostgreSQL + Redis for local dev
├── Dockerfile                    # Production backend image (Node 20 Alpine)
└── package.json                  # Monorepo root (npm workspaces)
```

## Quick Start

### Prerequisites

- **Node.js** >= 20
- **npm** >= 9
- **Docker & Docker Compose** (for local PostgreSQL + Redis) — or provide external services

### 1. Clone & install

```bash
git clone https://github.com/suwantara/task-app.git
cd task-app
npm install
```

### 2. Start infrastructure

```bash
docker-compose up -d
# PostgreSQL → localhost:5432
# Redis      → localhost:6380
```

### 3. Configure environment

```bash
# Backend — create from the template below
cp apps/backend/.env.example apps/backend/.env
# Then fill in the values
```

Create `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:3000
NEXT_PUBLIC_WS_URL=http://127.0.0.1:3000
```

### 4. Setup database

```bash
cd apps/backend
npx prisma migrate dev
cd ../..
```

### 5. Run development servers

```bash
# Terminal 1 — Backend
npm run dev:backend

# Terminal 2 — Frontend
npm run dev:frontend
```

Open [http://localhost:3000](http://localhost:3000) for the API (Swagger at `/api`) and [http://localhost:3001](http://localhost:3001) for the frontend.

## Environment Variables

### Backend (`apps/backend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/task-manager` |
| `JWT_SECRET` | Random secret for JWT signing (min 64 chars) | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `PORT` | Server port | `3000` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3001` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6380` |
| `REDIS_PASSWORD` | Redis password (optional for local) | — |

### Frontend (`apps/frontend/.env.local`)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://127.0.0.1:3000` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (same as API) | `http://127.0.0.1:3000` |

## API Endpoints

| Resource | Endpoints |
|----------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/profile` |
| Workspaces | `GET/POST /workspaces`, `PATCH/DELETE /workspaces/:id`, join via invite link |
| Boards | `GET/POST /boards`, `PATCH/DELETE /boards/:id` |
| Columns | `GET/POST /columns`, `PATCH/DELETE /columns/:id` (includes color) |
| Tasks | `GET/POST /tasks`, `PATCH/DELETE /tasks/:id` |
| Notes | `GET/POST /notes`, `PATCH/DELETE /notes/:id` |
| Health | `GET /health` |

Full interactive docs at `http://localhost:3000/api` (Swagger UI).

## Database Schema

```
User ──< WorkspaceMember >── Workspace ──< Board ──< Column ──< Task
  │                              │                                │
  └── UserSettings               └── Note                   Label ┘
                                 └── WorkspaceInviteLink
```

Key models: **User**, **Workspace**, **WorkspaceMember**, **Board**, **Column** (with color), **Task** (with priority, due date, assignee), **Note** (Tiptap JSON), **Label**.

Run `npx prisma studio` for a visual database browser.

## Deployment

### Frontend → Vercel

1. Import repo on [vercel.com](https://vercel.com)
2. **Root Directory**: `apps/frontend`
3. **Framework Preset**: Next.js
4. **Install Command** (override): `cd ../.. && npm install && npm run build:shared`
5. **Environment variables**: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`

### Backend → Railway

1. Create project on [railway.app](https://railway.app), connect repo
2. The root `Dockerfile` builds the backend
3. **Environment variables**: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `FRONTEND_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
4. Migrations run automatically on container start

### Database → Neon

1. Create project at [neon.tech](https://neon.tech)
2. Copy connection string to `DATABASE_URL`

### Redis → Upstash

1. Create database at [upstash.com](https://upstash.com)
2. Copy host, port, password to env vars

## Testing

```bash
cd apps/backend
npm test              # Unit tests (Jest)
npm run test:cov      # With coverage
npm run test:e2e      # End-to-end
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev:backend` | Start backend in watch mode |
| `npm run dev:frontend` | Start frontend dev server |
| `npm run build:backend` | Build backend for production |
| `npm run build:frontend` | Build frontend for production |
| `npm run build:shared` | Compile shared-types package |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Deploy migrations |
| `npm run prisma:studio` | Open Prisma Studio |

## Self-Hosting

You can run TaskFlow entirely on your own infrastructure with Docker.

```bash
# 1. Build the backend image
docker build -t taskflow-backend .

# 2. Supply required environment variables and run
docker run -d \
  -e DATABASE_URL="postgresql://user:password@your-db:5432/taskflow" \
  -e JWT_SECRET="<64-char random string>" \
  -e REDIS_HOST="your-redis-host" \
  -e REDIS_PORT="6379" \
  -e REDIS_PASSWORD="your-redis-password" \
  -e FRONTEND_URL="https://your-frontend.com" \
  -p 3000:3000 \
  taskflow-backend
```

The backend Docker image (Node 20 Alpine) automatically runs `prisma migrate deploy` on startup, so all database migrations are applied before the server comes up.

For the frontend, deploy the `apps/frontend` directory to any platform that supports Next.js (Vercel, Coolify, self-hosted Node server, etc.). Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` to point to your backend.

## Contributing

Contributions are welcome — bug fixes, features, documentation improvements, and translations.

### Getting started

1. **Fork** the repository and clone your fork
2. Install dependencies: `npm install`
3. Start infrastructure: `docker-compose up -d`
4. Create a feature branch: `git checkout -b feat/my-feature`
5. Make your changes with tests where appropriate
6. Run tests: `cd apps/backend && npm test`
7. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add label filtering on board view
   fix: prevent double-emit on task:move
   docs: update self-hosting guide
   refactor: extract usePresence hook
   ```
8. Push your branch and open a Pull Request against `main`

### Branch naming

| Prefix | Purpose |
|--------|---------|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `refactor/` | Code change without behavior change |
| `chore/` | Build / tooling / dependency updates |

### Code style

- Backend: ESLint + Prettier (NestJS defaults) — `npm run lint`
- Frontend: ESLint (Next.js config) — `npm run lint`
- All TypeScript, no `any` unless absolutely necessary
- Keep PRs focused — one concern per PR

### Reporting issues

Please open a GitHub issue with:
- A clear description of the bug or feature request
- Steps to reproduce (for bugs)
- Environment details (OS, Node version, browser)

## License

This project is licensed under the [MIT License](LICENSE).

You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, including for commercial use.

## Acknowledgments

- [NestJS](https://nestjs.com/) — progressive Node.js framework
- [Next.js](https://nextjs.org/) — React framework
- [Prisma](https://prisma.io/) — next-generation ORM
- [shadcn/ui](https://ui.shadcn.com/) — beautiful component library
- [Socket.IO](https://socket.io/) — real-time bidirectional engine
- [Tiptap](https://tiptap.dev/) — headless rich-text editor
- [TanStack Query](https://tanstack.com/query) — powerful async state management
- [Yjs](https://yjs.dev/) — CRDT framework for collaborative editing
- [ioredis](https://github.com/redis/ioredis) — robust Redis client for Node.js

---

Built by [@suwantara](https://github.com/suwantara)
