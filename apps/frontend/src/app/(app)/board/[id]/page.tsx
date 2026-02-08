'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { useParams } from 'next/navigation';
import { apiClient, PRIORITY_CONFIG } from '@/lib/api';
import type { TaskPriority, Board, Column, Task } from '@/lib/api';
import { useBoardRealtime } from '@/hooks/use-realtime';
import { useBoard, useColumns as useColumnsQuery, useTasks as useTasksQuery, queryKeys } from '@/hooks/use-queries';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Trash2,
  Clock,
  AlignLeft,
  Star,
  RefreshCw,
  Palette,
  Check,
} from 'lucide-react';

export default function BoardPage() {
  const { user, loading: authLoading } = useAuthGuard();
  const params = useParams();
  const boardId = params.id as string;
  const qc = useQueryClient();

  // 9 column color options
  const COLUMN_COLORS: readonly { readonly name: string; readonly value: string; readonly bg: string; readonly border: string; readonly dot: string }[] = [
    { name: 'Red', value: 'red', bg: 'bg-red-500/8', border: 'border-t-red-500', dot: 'bg-red-500' },
    { name: 'Orange', value: 'orange', bg: 'bg-orange-500/8', border: 'border-t-orange-500', dot: 'bg-orange-500' },
    { name: 'Yellow', value: 'yellow', bg: 'bg-yellow-500/8', border: 'border-t-yellow-500', dot: 'bg-yellow-500' },
    { name: 'Green', value: 'green', bg: 'bg-green-500/8', border: 'border-t-green-500', dot: 'bg-green-500' },
    { name: 'Teal', value: 'teal', bg: 'bg-teal-500/8', border: 'border-t-teal-500', dot: 'bg-teal-500' },
    { name: 'Blue', value: 'blue', bg: 'bg-blue-500/8', border: 'border-t-blue-500', dot: 'bg-blue-500' },
    { name: 'Indigo', value: 'indigo', bg: 'bg-indigo-500/8', border: 'border-t-indigo-500', dot: 'bg-indigo-500' },
    { name: 'Purple', value: 'purple', bg: 'bg-purple-500/8', border: 'border-t-purple-500', dot: 'bg-purple-500' },
    { name: 'Pink', value: 'pink', bg: 'bg-pink-500/8', border: 'border-t-pink-500', dot: 'bg-pink-500' },
  ] as const;

  const getColumnColor = (color?: string | null) =>
    COLUMN_COLORS.find((c) => c.value === color);

  // React Query
  const { data: board = null, isLoading: boardLoading } = useBoard(boardId);
  const { data: columnsRaw = [], isLoading: colsLoading } = useColumnsQuery(boardId);
  const { data: tasks = [], isLoading: tasksLoading } = useTasksQuery(boardId);
  const columns = [...(columnsRaw as Column[])].sort((a, b) => a.position - b.position);
  const loading = boardLoading || colsLoading || tasksLoading;

  const invalidateBoard = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.board(boardId) });
    qc.invalidateQueries({ queryKey: queryKeys.columns(boardId) });
    qc.invalidateQueries({ queryKey: queryKeys.tasks(boardId) });
  }, [qc, boardId]);

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
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');

  // Column rename/delete
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [renameColumnValue, setRenameColumnValue] = useState('');
  const [columnPopoverId, setColumnPopoverId] = useState<string | null>(null);
  const renameColumnRef = useRef<HTMLInputElement>(null);

  // Drag and drop
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Realtime collaboration
  const { emitTaskMove } = useBoardRealtime(boardId, {
    onTaskCreated: (task) => {
      const t = task as Task;
      qc.setQueryData(queryKeys.tasks(boardId), (old: Task[] | undefined) => {
        if (!old) return [t];
        if (old.some((p) => p.id === t.id)) return old;
        return [...old, t];
      });
    },
    onTaskUpdated: (task) => {
      const t = task as Task;
      qc.setQueryData(queryKeys.tasks(boardId), (old: Task[] | undefined) =>
        old ? old.map((p) => (p.id === t.id ? t : p)) : old,
      );
    },
    onTaskDeleted: (data) => {
      qc.setQueryData(queryKeys.tasks(boardId), (old: Task[] | undefined) =>
        old ? old.filter((p) => p.id !== data.id) : old,
      );
    },
    onTaskMoved: (data) => {
      qc.setQueryData(queryKeys.tasks(boardId), (old: Task[] | undefined) =>
        old
          ? old.map((t) =>
              t.id === data.taskId
                ? { ...t, columnId: data.toColumnId, position: data.position }
                : t,
            )
          : old,
      );
    },
    onColumnCreated: (column) => {
      const c = column as Column;
      qc.setQueryData(queryKeys.columns(boardId), (old: Column[] | undefined) => {
        if (!old) return [c];
        if (old.some((p) => p.id === c.id)) return old;
        return [...old, c].toSorted((a, b) => a.position - b.position);
      });
    },
    onColumnUpdated: (column) => {
      const c = column as Column;
      qc.setQueryData(queryKeys.columns(boardId), (old: Column[] | undefined) =>
        old ? old.map((p) => (p.id === c.id ? { ...p, ...c } : p)) : old,
      );
    },
  });

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
      const created = await apiClient.createColumn(boardId, name, columns.length);
      // Optimistic: add to cache immediately
      qc.setQueryData(queryKeys.columns(boardId), (old: Column[] | undefined) => {
        if (!old) return [created];
        if (old.some((c) => c.id === created.id)) return old;
        return [...old, created].toSorted((a, b) => a.position - b.position);
      });
    } catch (error) {
      console.error('Failed to create column:', error);
    }
  };

  const handleCreateTask = async (columnId: string) => {
    if (!newCardTitle.trim() || !board) return;

    const title = newCardTitle;
    setNewCardTitle('');
    setAddingCardColumnId(null);
    const columnTasks = tasks.filter((t: Task) => t.columnId === columnId);
    try {
      const created = await apiClient.createTask({
        workspaceId: (board as Board).workspaceId,
        boardId,
        columnId,
        title,
        position: columnTasks.length,
      });
      // Optimistic: add to cache immediately (realtime will handle other browsers)
      qc.setQueryData(queryKeys.tasks(boardId), (old: Task[] | undefined) => {
        if (!old) return [created];
        if (old.some((t) => t.id === created.id)) return old;
        return [...old, created];
      });
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
      const updated = await apiClient.updateTask(editingTask.id, {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
      });
      // Optimistic: update in cache immediately
      qc.setQueryData(queryKeys.tasks(boardId), (old: Task[] | undefined) =>
        old ? old.map((t) => (t.id === updated.id ? updated : t)) : old,
      );
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiClient.deleteTask(taskId);
      // Optimistic: remove from cache immediately
      qc.setQueryData(queryKeys.tasks(boardId), (old: Task[] | undefined) =>
        old ? old.filter((t) => t.id !== taskId) : old,
      );
      if (editingTask?.id === taskId) setEditingTask(null);
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

    const columnTasks = (tasks as Task[]).filter((t) => t.columnId === columnId);
    const fromColumnId = draggedTask.columnId;
    const newPosition = columnTasks.length;

    // Optimistic update via React Query cache
    qc.setQueryData(queryKeys.tasks(boardId), (old: Task[] | undefined) =>
      old
        ? old.map((t) =>
            t.id === draggedTask.id
              ? { ...t, columnId, position: newPosition }
              : t,
          )
        : old,
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
      invalidateBoard(); // Revert on error
    } finally {
      setDraggedTask(null);
      setDragOverColumn(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-4 border-b px-6 py-3">
          <Skeleton className="h-6 w-40" />
        </div>
        <ScrollArea orientation="horizontal" className="min-h-0 flex-1">
          <div className="flex h-full gap-3 p-4">
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
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
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
                <Button variant="ghost" size="sm" onClick={invalidateBoard}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reload board</TooltipContent>
            </Tooltip>
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
        <ScrollArea orientation="horizontal" className="min-h-0 flex-1">
          <div className="flex h-full gap-3 p-4">
          {columns.map((column) => {
            const columnTasks = tasks
              .filter((t) => t.columnId === column.id)
              .sort((a, b) => a.position - b.position);

            return (
              <section
                key={column.id}
                aria-label={`Column: ${column.name}`}
                className={`flex max-h-full w-68 shrink-0 flex-col rounded-xl bg-muted/50 ${
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
                  {renamingColumnId === column.id ? (
                    <form
                      className="flex-1 mr-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!renameColumnValue.trim()) return;
                        try {
                          await apiClient.updateColumn(column.id, { name: renameColumnValue.trim() });
                          qc.setQueryData(queryKeys.columns(boardId), (old: Column[] | undefined) =>
                            old ? old.map((c) => c.id === column.id ? { ...c, name: renameColumnValue.trim() } : c) : old,
                          );
                        } catch (err) {
                          console.error('Failed to rename column:', err);
                        }
                        setRenamingColumnId(null);
                      }}
                    >
                      <Input
                        ref={renameColumnRef}
                        value={renameColumnValue}
                        onChange={(e) => setRenameColumnValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setRenamingColumnId(null);
                        }}
                        onBlur={() => setRenamingColumnId(null)}
                        className="h-7 text-sm"
                        autoFocus
                      />
                    </form>
                  ) : (
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      {column.name}
                    </h3>
                  )}
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs h-5 min-w-5 justify-center">
                      {columnTasks.length}
                    </Badge>
                    <Popover
                      open={columnPopoverId === column.id}
                      onOpenChange={(open) => setColumnPopoverId(open ? column.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <button className="rounded p-0.5 text-muted-foreground hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-1" align="start">
                        <button
                          onClick={() => {
                            setRenamingColumnId(column.id);
                            setRenameColumnValue(column.name);
                            setColumnPopoverId(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </button>
                        <div className="px-2 py-1.5">
                          <span className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <Palette className="h-3.5 w-3.5" />
                            Color
                          </span>
                          <div className="grid grid-cols-5 gap-1.5">
                            {COLUMN_COLORS.map((c) => (
                              <button
                                key={c.value}
                                onClick={async () => {
                                  try {
                                    await apiClient.updateColumn(column.id, { color: c.value });
                                    qc.setQueryData(queryKeys.columns(boardId), (old: Column[] | undefined) =>
                                      old ? old.map((col) => col.id === column.id ? { ...col, color: c.value } : col) : old,
                                    );
                                  } catch (err) {
                                    console.error('Failed to update column color:', err);
                                  }
                                }}
                                className="group/color flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
                                title={c.name}
                              >
                                <span className={`h-5 w-5 rounded-full ${c.dot} flex items-center justify-center`}>
                                  {column.color === c.value && (
                                    <Check className="h-3 w-3 text-white" />
                                  )}
                                </span>
                              </button>
                            ))}
                            <button
                              onClick={async () => {
                                try {
                                  await apiClient.updateColumn(column.id, { color: null });
                                  qc.setQueryData(queryKeys.columns(boardId), (old: Column[] | undefined) =>
                                    old ? old.map((col) => col.id === column.id ? { ...col, color: null } : col) : old,
                                  );
                                } catch (err) {
                                  console.error('Failed to remove column color:', err);
                                }
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 transition-transform hover:scale-110"
                              title="No color"
                            >
                              {!column.color && (
                                <Check className="h-3 w-3 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            setColumnPopoverId(null);
                            try {
                              await apiClient.deleteColumn(column.id);
                              qc.setQueryData(queryKeys.columns(boardId), (old: Column[] | undefined) =>
                                old ? old.filter((c) => c.id !== column.id) : old,
                              );
                              // Remove tasks from deleted column
                              qc.setQueryData(queryKeys.tasks(boardId), (old: Task[] | undefined) =>
                                old ? old.filter((t) => t.columnId !== column.id) : old,
                              );
                            } catch (err) {
                              console.error('Failed to delete column:', err);
                            }
                          }}
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Column color indicator */}
                {column.color && (
                  <div className={`mx-3 mt-2 mb-1 h-0.5 rounded-full ${getColumnColor(column.color)?.dot ?? ''}`} />
                )}

                {/* Cards */}
                <ScrollArea className="flex-1 px-2">
                  <div className="space-y-2 p-1">
                    {columnTasks.map((task) => {
                      const colColor = getColumnColor(column.color);
                      return (
                      <article
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task)}
                        className={`group relative cursor-grab rounded-lg border bg-card p-3 shadow-sm hover:shadow-md hover:border-primary/30 active:cursor-grabbing ${
                          draggedTask?.id === task.id ? 'opacity-40' : ''
                        }`}
                      >
                        {/* Color bar — column color if set, otherwise priority */}
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${colColor?.dot ?? PRIORITY_CONFIG[task.priority].color}`}
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
                                className={`h-1.5 w-1.5 rounded-full ${PRIORITY_CONFIG[task.priority].color}`}
                              />
                              {PRIORITY_CONFIG[task.priority].label}
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
                      );
                    })}

                    {/* Inline add card */}
                    {addingCardColumnId === column.id ? (
                      <div className="rounded-lg border bg-card p-3 shadow-sm">
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
                          className="min-h-15 resize-none border-0 p-2 text-sm shadow-none focus-visible:ring-0"
                          rows={2}
                        />
                        <div className="mt-3 flex items-center gap-3">
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
                  <div className="flex items-center gap-3">
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
        </ScrollArea>

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
                  onValueChange={(v) => setEditPriority(v as TaskPriority)}
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
  );
}
