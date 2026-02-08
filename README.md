# TaskFlow

> Open-source, real-time collaborative task management app built with NestJS, Next.js, PostgreSQL, and Redis.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **Workspaces** — organize teams with role-based access (Owner / Editor / Viewer)
- **Kanban Boards** — drag-and-drop columns & cards with column color coding
- **Real-time Collaboration** — instant updates via Socket.IO + Redis pub/sub
- **Rich Notes** — Tiptap editor with autosave and typing indicators
- **Single-Session Auth** — JWT + Redis session enforcement (one device at a time)
- **Invite Links** — short-code workspace invitations with role & expiry
- **Calendar View** — visualize tasks by due date
- **Presence Indicators** — see who's online in real-time
- **Dark Mode** — system-aware theme switching
- **Swagger API Docs** — auto-generated at `/api`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, React Query v5, Socket.IO Client |
| Backend | NestJS 11, Prisma 6, Passport JWT, Socket.IO, class-validator |
| Database | PostgreSQL 15 |
| Cache & Pub/Sub | Redis 7 (ioredis) |
| Shared | TypeScript monorepo (npm workspaces), shared-types package |
| Deploy | Vercel (frontend) + Railway (backend) + Neon (database) + Upstash (Redis) |

## Project Structure

```
task-app/
├── apps/
│   ├── backend/           # NestJS REST API + WebSocket gateway
│   │   ├── prisma/        # Schema & migrations
│   │   └── src/
│   │       ├── auth/      # JWT auth, session management
│   │       ├── boards/    # Board CRUD
│   │       ├── columns/   # Column CRUD + color
│   │       ├── tasks/     # Task CRUD + move
│   │       ├── notes/     # Notes with autosave
│   │       ├── workspaces/# Workspace + invite links
│   │       ├── realtime/  # Socket.IO gateway + Redis adapter
│   │       ├── cache/     # Redis cache service
│   │       └── common/    # Permissions, decorators
│   └── frontend/          # Next.js App Router
│       └── src/
│           ├── app/       # Pages (board, workspace, notes, etc.)
│           ├── components/# UI components (shadcn/ui)
│           ├── contexts/  # Auth, Socket, Theme providers
│           ├── hooks/     # React Query hooks, realtime hooks
│           └── lib/       # API client, utilities
├── packages/
│   └── shared-types/      # Shared TypeScript interfaces & enums
├── docker-compose.yml     # PostgreSQL + Redis for local dev
├── Dockerfile             # Production backend image
└── package.json           # Monorepo root (npm workspaces)
```

## Quick Start

### Prerequisites

- **Node.js** >= 20
- **npm** >= 9
- **Docker** (for local PostgreSQL + Redis) — or external services

### 1. Clone & install

```bash
git clone https://github.com/suwantara/task-app.git
cd task-app
npm install
```

### 2. Start infrastructure

```bash
docker-compose up -d   # PostgreSQL on :5432, Redis on :6380
```

### 3. Configure environment

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env — see Environment Variables below
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

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

- [NestJS](https://nestjs.com/) — progressive Node.js framework
- [Next.js](https://nextjs.org/) — React framework
- [Prisma](https://prisma.io/) — next-generation ORM
- [shadcn/ui](https://ui.shadcn.com/) — beautiful component library
- [Socket.IO](https://socket.io/) — real-time engine
- [Tiptap](https://tiptap.dev/) — rich text editor

---

Built by [@suwantara](https://github.com/suwantara)
