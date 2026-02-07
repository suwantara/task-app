'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useBoardRealtime } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  X,
  MoreHorizontal,
  Pencil,
  Clock,
  AlignLeft,
  Star,
} from 'lucide-react';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
}

interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  columnId: string;
  position: number;
  dueDate?: string;
}

const priorityColor: Record<Priority, string> = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-emerald-500',
};

const priorityLabel: Record<Priority, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export default function BoardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const boardId = params.id as string;

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Create column
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const columnInputRef = useRef<HTMLInputElement>(null);

  // Inline add card
  const [addingCardColumnId, setAddingCardColumnId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const cardInputRef = useRef<HTMLTextAreaElement>(null);

  // Edit task dialog
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('MEDIUM');

  // Drag and drop
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Realtime collaboration
  const { emitTaskMove } = useBoardRealtime(boardId, {
    onTaskCreated: (task) => {
      setTasks((prev) => {
        const t = task as Task;
        if (prev.some((p) => p.id === t.id)) return prev;
        return [...prev, t];
      });
    },
    onTaskUpdated: (task) => {
      const t = task as Task;
      setTasks((prev) => prev.map((p) => (p.id === t.id ? t : p)));
    },
    onTaskDeleted: (data) => {
      setTasks((prev) => prev.filter((p) => p.id !== data.id));
    },
    onTaskMoved: (data) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === data.taskId
            ? { ...t, columnId: data.toColumnId, position: data.position }
            : t,
        ),
      );
    },
    onColumnCreated: (column) => {
      setColumns((prev) => {
        const c = column as Column;
        if (prev.some((p) => p.id === c.id)) return prev;
        return [...prev, c].toSorted((a, b) => a.position - b.position);
      });
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  const loadBoardData = useCallback(async () => {
    try {
      const [boardData, columnsData, tasksData] = await Promise.all([
        apiClient.getBoard(boardId),
        apiClient.getColumns(boardId),
        apiClient.getTasks(boardId),
      ]);
      setBoard(boardData);
      setColumns(columnsData.toSorted((a: Column, b: Column) => a.position - b.position));
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to load board data:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (user && boardId) {
      loadBoardData();
    }
  }, [user, boardId, loadBoardData]);

  // Focus on input when adding column
  useEffect(() => {
    if (addingColumn && columnInputRef.current) {
      columnInputRef.current.focus();
    }
  }, [addingColumn]);

  // Focus on textarea when adding card
  useEffect(() => {
    if (addingCardColumnId && cardInputRef.current) {
      cardInputRef.current.focus();
    }
  }, [addingCardColumnId]);

  const handleCreateColumn = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;

    const name = newColumnName;
    setNewColumnName('');
    setAddingColumn(false);
    try {
      await apiClient.createColumn(boardId, name, columns.length);
      loadBoardData();
    } catch (error) {
      console.error('Failed to create column:', error);
    }
  };

  const handleCreateTask = async (columnId: string) => {
    if (!newCardTitle.trim() || !board) return;

    const title = newCardTitle;
    setNewCardTitle('');
    setAddingCardColumnId(null);
    const columnTasks = tasks.filter((t) => t.columnId === columnId);
    try {
      await apiClient.createTask({
        workspaceId: board.workspaceId,
        boardId,
        columnId,
        title,
        position: columnTasks.length,
      });
      loadBoardData();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
  };

  const handleSaveTask = async () => {
    if (!editingTask) return;
    try {
      await apiClient.updateTask(editingTask.id, {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
      });
      setEditingTask(null);
      loadBoardData();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiClient.deleteTask(taskId);
      loadBoardData();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (columnId: string) => {
    if (!draggedTask || draggedTask.columnId === columnId) {
      setDraggedTask(null);
      setDragOverColumn(null);
      return;
    }

    const columnTasks = tasks.filter((t) => t.columnId === columnId);
    const fromColumnId = draggedTask.columnId;
    const newPosition = columnTasks.length;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === draggedTask.id
          ? { ...t, columnId, position: newPosition }
          : t,
      ),
    );

    // Emit realtime event
    emitTaskMove(draggedTask.id, fromColumnId, columnId, newPosition);

    try {
      await apiClient.updateTask(draggedTask.id, {
        columnId,
        position: newPosition,
      } as Partial<{ workspaceId: string; boardId: string; columnId: string; title: string; description?: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH'; dueDate?: string; position: number }>);
    } catch (error) {
      console.error('Failed to move task:', error);
      loadBoardData(); // Revert on error
    } finally {
      setDraggedTask(null);
      setDragOverColumn(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-[calc(100vh-3rem)] flex-col">
        <div className="flex items-center gap-4 border-b px-6 py-3">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-68 shrink-0">
              <Skeleton className="mb-3 h-8 w-full rounded" />
              <div className="space-y-2">
                <Skeleton className="h-20 w-full rounded" />
                <Skeleton className="h-20 w-full rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
        {/* Board Header */}
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{board?.name}</h1>
            {board?.description && (
              <Tooltip>
                <TooltipTrigger>
                  <AlignLeft className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>{board.description}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Star className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Star board</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Board settings</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Columns */}
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {columns.map((column) => {
            const columnTasks = tasks
              .filter((t) => t.columnId === column.id)
              .sort((a, b) => a.position - b.position);

            return (
              <section
                key={column.id}
                aria-label={`Column: ${column.name}`}
                className={`flex w-68 shrink-0 flex-col rounded-xl bg-muted/50 transition-shadow duration-100 ${
                  dragOverColumn === column.id
                    ? 'ring-2 ring-primary/50'
                    : ''
                }`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(column.id)}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {column.name}
                  </h3>
                  <Badge variant="secondary" className="text-xs h-5 min-w-5 justify-center">
                    {columnTasks.length}
                  </Badge>
                </div>

                {/* Cards */}
                <ScrollArea className="flex-1 px-2">
                  <div className="space-y-2 p-1">
                    {columnTasks.map((task) => (
                      <article
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task)}
                        className={`group relative cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow duration-150 hover:shadow-md hover:border-primary/30 active:cursor-grabbing ${
                          draggedTask?.id === task.id ? 'opacity-40' : ''
                        }`}
                      >
                        {/* Priority bar */}
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${priorityColor[task.priority]}`}
                        />

                        <div className="pl-2">
                          <div className="flex items-start justify-between">
                            <span className="text-sm font-medium leading-tight">
                              {task.title}
                            </span>
                            <div className="ml-1 flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleEditTask(task)}
                                    className="rounded p-0.5 hover:bg-accent"
                                  >
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="rounded p-0.5 hover:bg-destructive/20"
                                  >
                                    <X className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                          {task.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="h-5 text-[10px] gap-0.5"
                            >
                              <div
                                className={`h-1.5 w-1.5 rounded-full ${priorityColor[task.priority]}`}
                              />
                              {priorityLabel[task.priority]}
                            </Badge>
                            {task.dueDate && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}

                    {/* Inline add card */}
                    {addingCardColumnId === column.id ? (
                      <div className="rounded-lg border bg-card p-2 shadow-sm">
                        <Textarea
                          ref={cardInputRef}
                          placeholder="Enter a title for this card…"
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleCreateTask(column.id);
                            }
                            if (e.key === 'Escape') {
                              setAddingCardColumnId(null);
                              setNewCardTitle('');
                            }
                          }}
                          className="min-h-15 resize-none border-0 p-1 text-sm shadow-none focus-visible:ring-0"
                          rows={2}
                        />
                        <div className="mt-1 flex items-center gap-1">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleCreateTask(column.id)}
                          >
                            Add card
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setAddingCardColumnId(null);
                              setNewCardTitle('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingCardColumnId(column.id);
                          setNewCardTitle('');
                        }}
                        className="flex w-full items-center gap-1 rounded-lg p-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
                      >
                        <Plus className="h-4 w-4" />
                        Add a card
                      </button>
                    )}
                  </div>
                </ScrollArea>
              </section>
            );
          })}

          {/* Add column */}
          <div className="w-68 shrink-0">
            {addingColumn ? (
              <div className="rounded-xl bg-muted/50 p-3">
                <form onSubmit={handleCreateColumn}>
                  <Input
                    ref={columnInputRef}
                    placeholder="Enter list title…"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setAddingColumn(false);
                        setNewColumnName('');
                      }
                    }}
                    className="mb-2"
                  />
                  <div className="flex items-center gap-1">
                    <Button size="sm" type="submit" className="h-7 text-xs">
                      Add list
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setAddingColumn(false);
                        setNewColumnName('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="flex w-full items-center gap-2 rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
              >
                <Plus className="h-4 w-4" />
                Add another list
              </button>
            )}
          </div>
        </div>

        {/* Edit Task Dialog */}
        <Dialog
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>Update task details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Title</Label>
                <Input
                  id="task-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-desc">Description</Label>
                <Textarea
                  id="task-desc"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={editPriority}
                  onValueChange={(v) => setEditPriority(v as Priority)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTask(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTask}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Dialog>
    </div>
  );
}
