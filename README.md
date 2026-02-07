# Task Management Application

A full-stack task management application with real-time collaboration features. Built with modern technologies and best practices.

## 🚀 Features

- **User Authentication**: Secure registration and login with JWT
- **Workspaces**: Organize your work into separate collaborative spaces
- **Kanban Boards**: Visual project management with drag-and-drop
- **Task Management**: Create, edit, and organize tasks with priorities
- **Notes**: Document your work with a built-in note-taking system
- **Real-time Updates**: WebSocket support for live collaboration
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🏗️ Project Structure

This is a monorepo containing:

```
task-app/
├── apps/
│   ├── backend/          # NestJS backend API
│   └── frontend/         # Next.js frontend application
├── packages/
│   └── shared-types/     # Shared TypeScript types
└── docker-compose.yml    # Docker configuration
```

## 🛠️ Tech Stack

### Backend
- **NestJS**: Progressive Node.js framework
- **Prisma**: Next-generation ORM
- **PostgreSQL**: Robust relational database
- **JWT**: Secure authentication
- **WebSockets**: Real-time communication
- **Swagger**: API documentation

### Frontend
- **Next.js 16**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Shadcn/UI**: High-quality components
- **@dnd-kit**: Drag-and-drop functionality

## 🚦 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/suwantara/task-app.git
cd task-app

# Start services with Docker Compose
docker-compose up -d

# Access the application
# Frontend: http://localhost:3001
# Backend API: http://localhost:3000
# API Docs: http://localhost:3000/api
```

### Manual Setup

#### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd apps/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

#### 2. Setup Backend

```bash
cd apps/backend

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npx prisma migrate dev

# Start backend server
npm run start:dev
```

#### 3. Setup Frontend

```bash
cd apps/frontend

# Configure environment
cp .env.local.example .env.local
# Edit .env.local and set NEXT_PUBLIC_API_URL

# Start frontend server
npm run dev
```

## 📁 Project Details

### Backend API

The backend provides a RESTful API with the following endpoints:

- **Auth**: `/auth/login`, `/auth/register`, `/auth/profile`
- **Workspaces**: `/workspaces/*`
- **Boards**: `/boards/*`
- **Columns**: `/columns/*`
- **Tasks**: `/tasks/*`
- **Notes**: `/notes/*`

API documentation is available at `http://localhost:3000/api` (Swagger UI).

### Frontend Application

The frontend includes:

- Landing page with feature overview
- Authentication pages (login/register)
- Dashboard with workspace management
- Board view with Kanban functionality
- Notes page for documentation
- Responsive design for all screen sizes

## 🗄️ Database Schema

The application uses the following main entities:

- **User**: Authentication and user profiles
- **Workspace**: Collaborative workspaces
- **Board**: Kanban boards within workspaces
- **Column**: Board columns (e.g., To Do, In Progress, Done)
- **Task**: Individual tasks with priorities and assignments
- **Note**: Documentation and notes
- **Label**: Task categorization

## 🔒 Environment Variables

### Backend (.env)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/taskapp"
JWT_SECRET="your-secret-key"
PORT=3000
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## 📝 Development

### Run Tests

```bash
# Backend tests
cd apps/backend
npm test

# Frontend tests (if available)
cd apps/frontend
npm test
```

### Build for Production

```bash
# Build backend
cd apps/backend
npm run build

# Build frontend
cd apps/frontend
npm run build
```

### Code Quality

```bash
# Lint backend
cd apps/backend
npm run lint

# Lint frontend
cd apps/frontend
npm run lint
```

## 🐳 Docker Support

The project includes Docker configuration for easy deployment:

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- NestJS for the excellent backend framework
- Next.js for the powerful React framework
- Prisma for the amazing ORM
- The open-source community

## 📞 Support

For questions or issues, please open an issue on GitHub.

---

Made with ❤️ by the task-app team
