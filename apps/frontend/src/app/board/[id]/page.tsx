'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

interface Column {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  position: number;
  columnId: string;
  assigneeId?: string;
  dueDate?: string;
}

export default function BoardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const boardId = params.id as string;

  const [board, setBoard] = useState<any>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateColumnModal, setShowCreateColumnModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');
  const [newColumnName, setNewColumnName] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && boardId) {
      loadBoardData();
    }
  }, [user, boardId]);

  const loadBoardData = async () => {
    try {
      const [boardData, columnsData, tasksData] = await Promise.all([
        apiClient.getBoard(boardId),
        apiClient.getColumns(boardId),
        apiClient.getTasks(boardId),
      ]);

      setBoard(boardData);

      // Organize tasks by column
      const columnsWithTasks = columnsData
        .map((column: any) => ({
          ...column,
          tasks: tasksData
            .filter((task: any) => task.columnId === column.id)
            .sort((a: any, b: any) => a.position - b.position),
        }))
        .sort((a: any, b: any) => a.position - b.position);

      setColumns(columnsWithTasks);
    } catch (error) {
      console.error('Failed to load board data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;

    try {
      await apiClient.createColumn(boardId, newColumnName, columns.length);
      setNewColumnName('');
      setShowCreateColumnModal(false);
      loadBoardData();
    } catch (error) {
      console.error('Failed to create column:', error);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedColumnId) return;

    try {
      const column = columns.find((c) => c.id === selectedColumnId);
      await apiClient.createTask({
        workspaceId: board.workspaceId,
        boardId: boardId,
        columnId: selectedColumnId,
        title: newTaskTitle,
        description: newTaskDescription,
        priority: newTaskPriority,
        position: column?.tasks.length || 0,
      });
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('MEDIUM');
      setShowCreateTaskModal(false);
      setSelectedColumnId('');
      loadBoardData();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await apiClient.deleteTask(taskId);
      loadBoardData();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/workspace/${board?.workspaceId}`}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {board?.name}
              </h1>
              {board?.description && (
                <p className="text-sm text-gray-600">{board.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateColumnModal(true)}
              className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-500"
            >
              Add Column
            </button>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-80 rounded-lg bg-gray-100 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  {column.name}
                  <span className="ml-2 text-sm text-gray-500">
                    ({column.tasks.length})
                  </span>
                </h3>
                <button
                  onClick={() => {
                    setSelectedColumnId(column.id);
                    setShowCreateTaskModal(true);
                  }}
                  className="text-gray-600 hover:text-gray-900"
                  title="Add task"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                {column.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg bg-white p-4 shadow hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-gray-900">
                        {task.title}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete task"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                    {task.description && (
                      <p className="mt-2 text-sm text-gray-600">
                        {task.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${getPriorityColor(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                      {task.dueDate && (
                        <span className="text-xs text-gray-500">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {column.tasks.length === 0 && (
                  <p className="text-center text-sm text-gray-500 py-4">
                    No tasks yet
                  </p>
                )}
              </div>
            </div>
          ))}

          {columns.length === 0 && (
            <div className="flex-1 text-center py-12">
              <p className="text-gray-500">
                No columns yet. Add a column to get started!
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Create Column Modal */}
      {showCreateColumnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Create New Column
            </h3>
            <form onSubmit={handleCreateColumn}>
              <input
                type="text"
                placeholder="Column name (e.g., To Do, In Progress, Done)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                autoFocus
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateColumnModal(false);
                    setNewColumnName('');
                  }}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Create New Task
            </h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="Task title"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description (optional)
                </label>
                <textarea
                  placeholder="Task description"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  rows={3}
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  value={newTaskPriority}
                  onChange={(e) =>
                    setNewTaskPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')
                  }
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateTaskModal(false);
                    setNewTaskTitle('');
                    setNewTaskDescription('');
                    setNewTaskPriority('MEDIUM');
                    setSelectedColumnId('');
                  }}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
