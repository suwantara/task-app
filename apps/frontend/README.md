# TaskFlow — Frontend

Next.js 16 frontend for TaskFlow. Implements the full Kanban board, collaborative notes, workspace management, and real-time presence using Socket.IO and TanStack Query.

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16 | React framework (App Router) |
| `react` | 19 | UI library |
| `tailwindcss` | 4 | Utility-first CSS |
| `shadcn/ui` (radix-ui) | — | Accessible UI component primitives |
| `@tanstack/react-query` | 5 | Server state, caching, mutations |
| `socket.io-client` | 4 | WebSocket connection to backend |
| `@tiptap/react` | 3 | Rich-text editor (20+ extensions) |
| `yjs` + `y-prosemirror` | — | CRDT collaboration layer (Yjs-ready) |
| `next-themes` | — | System-aware dark/light mode |
| `lucide-react` | — | Icon library |
| `date-fns` | 4 | Date formatting |
| `react-day-picker` | 9 | Calendar / date picker |
| `sonner` | — | Toast notifications |
| `react-hotkeys-hook` | — | Keyboard shortcuts |
| `lodash.throttle` | — | Throttle cursor events |

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout with providers
│   ├── (auth)/                     # Public auth routes
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (app)/                      # Protected app routes
│       ├── dashboard/page.tsx      # Workspace list + creation
│       ├── workspace/[id]/page.tsx # Workspace boards overview
│       ├── board/[id]/page.tsx     # Kanban board with columns & tasks
│       ├── notes/page.tsx          # Collaborative notes (autosave)
│       └── calendar/page.tsx       # Calendar view of tasks by due date
│
├── components/
│   ├── ui/                         # shadcn/ui base components
│   ├── board/                      # Column, TaskCard, drag-drop wrappers
│   ├── notes/                      # NotesList, NoteEditor
│   ├── workspace/                  # WorkspaceCard, MemberList, InviteDialog
│   └── tiptap-templates/simple/    # SimpleEditor (Tiptap, Yjs-ready)
│
├── contexts/
│   ├── auth-context.tsx            # JWT token, user state, login/logout
│   ├── socket-context.tsx          # Socket.IO singleton, joinRoom/leaveRoom, presence
│   └── theme-context.tsx           # next-themes wrapper
│
├── hooks/
│   ├── use-realtime.ts             # useBoardRealtime, useNoteRealtime
│   ├── use-boards.ts               # TanStack Query mutations for boards
│   ├── use-columns.ts              # TanStack Query mutations for columns
│   ├── use-tasks.ts                # TanStack Query mutations for tasks
│   ├── use-notes.ts                # TanStack Query mutations for notes
│   └── use-workspaces.ts           # TanStack Query queries/mutations for workspaces
│
├── lib/
│   ├── api.ts                      # Typed fetch wrapper (JWT header injected)
│   └── utils.ts                    # cn(), formatDate(), misc utilities
│
├── providers/
│   └── query-client-provider.tsx   # TanStack QueryClientProvider
│
└── styles/
    └── globals.css                 # Tailwind base + CSS custom properties
```

## Key Architecture Decisions

### State Management

- **REST data** (boards, tasks, notes, users) is managed by **TanStack Query v5** — queries, mutations, and optimistic updates
- **Real-time events** from Socket.IO directly call `queryClient.setQueryData()` to patch the cache without a network re-fetch
- **Auth state** lives in `AuthContext` (React Context) and persists to `localStorage`

### Socket.IO Integration

`SocketContext` (`contexts/socket-context.tsx`) creates a single Socket.IO connection per authenticated session:

```ts
const socket = io(WS_URL, {
  auth: { token },
  transports: ['websocket'],   // no long-polling fallback
});
```

Rooms are joined with `joinRoom(room)` which also broadcasts presence metadata (name, avatar, current page).  
`useSocket()` exposes `{ socket, joinRoom, leaveRoom, onlineUsers }`.

### Realtime Hooks

`useBoardRealtime(boardId, callbacks)` — joins `board:{boardId}` room, listens for:
- `task:created`, `task:updated`, `task:deleted`, `task:moved`
- `column:created`, `column:updated`
- `cursor:update`

`useNoteRealtime(workspaceId, callbacks)` — joins `workspace:{workspaceId}` room, listens for:
- `note:created`, `note:updated`, `note:deleted`
- `note:typing`, `note:stop-typing`

### Notes Autosave

The notes page uses a 2-second debounce autosave:

```
Keystroke → setEditingContent + emit note:typing
          → scheduleAutosave (clearTimeout + setTimeout 2 s)
          → handleSaveNote → PATCH /notes/:id → emit note:stop-typing
```

Stale-closure issues are avoided by keeping content in `useRef` and reading from the ref inside the save handler.

### Tiptap Editor

`SimpleEditor` (`components/tiptap-templates/simple/simple-editor.tsx`) supports two modes:

- **HTML autosave mode** (default): `content` + `onChange` props, stores Tiptap HTML
- **Yjs CRDT mode**: pass `ydoc`, `awareness`, and `user` props to enable `Collaboration` + `CollaborationCursor` extensions

Extensions included: StarterKit, Highlight, Link, Image, CodeBlock (lowlight), Table, TaskList, TextAlign, Typography, Underline, Subscript, Superscript, Placeholder, and more.

## Environment Variables

Create `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:3000
NEXT_PUBLIC_WS_URL=http://127.0.0.1:3000
```

For production (Vercel):

```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_WS_URL=https://your-backend.railway.app
```

## Running Locally

```bash
# From monorepo root
npm install

# Start backend first (see apps/backend/README.md)

# Then start frontend
npm run dev:frontend
# http://localhost:3001
```

Or from this directory:

```bash
npm run dev     # http://localhost:3000 (default Next.js port)
npm run build   # Production build
npm start       # Serve production build
npm run lint    # ESLint
```

## Deployment (Vercel)

1. Import the monorepo on [vercel.com](https://vercel.com)
2. **Root Directory**: `apps/frontend`
3. **Framework Preset**: Next.js
4. **Install Command** (override): `cd ../.. && npm install && npm run build:shared`
5. **Build Command** (override): `npm run build`
6. **Environment variables**: set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`

The install command builds `packages/shared-types` first so the frontend can resolve `@task-app/shared-types`.

## License

This project is part of the task-app monorepo.

