# Task Management Frontend

A modern, responsive task management application built with Next.js, React, and Tailwind CSS.

## Features

- **Authentication**: Secure login and registration
- **Workspaces**: Organize your projects into separate workspaces
- **Kanban Boards**: Visual task management with drag-and-drop functionality
- **Tasks**: Create, edit, and delete tasks with priorities and descriptions
- **Notes**: Rich text note-taking for documentation
- **Real-time**: Ready for real-time collaboration (WebSocket integration)

## Tech Stack

- **Next.js 16**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/UI**: High-quality UI components
- **@dnd-kit**: Drag-and-drop functionality

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running (see apps/backend)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local and set NEXT_PUBLIC_API_URL

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Authentication pages
│   ├── board/             # Board/Kanban view
│   ├── dashboard/         # Main dashboard
│   ├── notes/             # Notes page
│   └── workspace/         # Workspace pages
├── contexts/              # React contexts
│   └── auth-context.tsx   # Authentication context
├── lib/                   # Utilities and helpers
│   ├── api.ts            # API client
│   └── utils.ts          # Utility functions
└── components/            # Reusable components (future)
```

## Features Overview

### Authentication
- Login and register pages
- JWT token management
- Protected routes

### Dashboard
- View all workspaces
- Create new workspaces
- Navigate to boards

### Workspaces
- Manage boards within a workspace
- Create new boards
- View board details

### Kanban Board
- Drag-and-drop tasks between columns
- Create, edit, and delete tasks
- Task priorities (Low, Medium, High)
- Visual task organization

### Notes
- Create and edit notes
- Organize notes by workspace
- Simple text editor

## API Integration

The frontend communicates with the backend API using the API client (`src/lib/api.ts`). All requests include JWT authentication tokens when available.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

This project is part of the task-app monorepo.

