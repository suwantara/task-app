'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useWorkspace } from '@/contexts/workspace-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Circle,
} from 'lucide-react';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

interface Board {
  id: string;
  name: string;
  workspaceId: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  columnId: string;
  boardId: string;
  workspaceId: string;
  position: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskRow extends Task {
  boardName: string;
  columnName: string;
  completed: boolean;
}

const priorityConfig: Record<Priority, { label: string; color: string }> = {
  HIGH: { label: 'High', color: 'bg-red-500' },
  MEDIUM: { label: 'Medium', color: 'bg-amber-500' },
  LOW: { label: 'Low', color: 'bg-emerald-500' },
};

type SortField = 'title' | 'priority' | 'dueDate' | 'boardName' | 'columnName' | 'createdAt';
type SortDir = 'asc' | 'desc';

export default function TasksTablePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const [boards, setBoards] = useState<Board[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  // Sort
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Filter
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterBoard, setFilterBoard] = useState<string>('all');

  // Edit dialog
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('MEDIUM');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Load tasks when workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      loadAllTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  const loadAllTasks = async () => {
    if (!activeWorkspace) return;
    setLoading(true);

    try {
      const boardsData = await apiClient.getBoards(activeWorkspace.id);
      setBoards(boardsData);

      const allTasks: TaskRow[] = [];

      for (const board of boardsData) {
        const [columnsData, tasksData] = await Promise.all([
          apiClient.getColumns(board.id),
          apiClient.getTasks(board.id),
        ]);

        const columnMap = new Map(columnsData.map((c) => [c.id, c.name]));

        for (const task of tasksData) {
          allTasks.push({
            ...task,
            boardName: board.name,
            columnName: columnMap.get(task.columnId) || 'Unknown',
            completed: completedTasks.has(task.id),
          });
        }
      }

      setTasks(allTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = (taskId: string) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      )
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleEditTask = (task: TaskRow) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    try {
      await apiClient.updateTask(editingTask.id, {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
      });
      setEditingTask(null);
      loadAllTasks();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiClient.deleteTask(taskId);
      loadAllTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  // Filter & sort
  const filteredTasks = tasks
    .filter((t) => {
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterBoard !== 'all' && t.boardId !== filterBoard) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (sortField === 'priority') {
        const order: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (
          ((order[valA] || 0) - (order[valB] || 0)) * dir
        );
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * dir;
      }
      return 0;
    });

  const completedCount = tasks.filter((t) => completedTasks.has(t.id)).length;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Table View</h1>
          <Badge variant="secondary" className="text-xs">
            {completedCount}/{tasks.length} done
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {activeWorkspace?.name || 'No workspace'}
          </span>

          <Select value={filterBoard} onValueChange={setFilterBoard}>
            <SelectTrigger className="w-37.5 h-8 text-sm">
              <SelectValue placeholder="Board" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Boards</SelectItem>
              {boards.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-32.5 h-8 text-sm">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={`sk${String(i)}`} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <CheckCircle2 className="size-4 text-muted-foreground" />
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 -ml-3 text-xs font-medium"
                    onClick={() => handleSort('title')}
                  >
                    Task
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 -ml-3 text-xs font-medium"
                    onClick={() => handleSort('boardName')}
                  >
                    Board
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 -ml-3 text-xs font-medium"
                    onClick={() => handleSort('columnName')}
                  >
                    Status
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 -ml-3 text-xs font-medium"
                    onClick={() => handleSort('priority')}
                  >
                    Priority
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 -ml-3 text-xs font-medium"
                    onClick={() => handleSort('dueDate')}
                  >
                    Due Date
                    <ArrowUpDown className="ml-1 size-3" />
                  </Button>
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    {tasks.length === 0
                      ? 'No tasks yet. Create tasks in your boards.'
                      : 'No tasks match the current filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className={
                      completedTasks.has(task.id)
                        ? 'opacity-50'
                        : 'hover:bg-muted/50'
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={completedTasks.has(task.id)}
                        onCheckedChange={() => toggleComplete(task.id)}
                        className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${priorityConfig[task.priority].color}`}
                        />
                        <span
                          className={
                            completedTasks.has(task.id)
                              ? 'line-through text-muted-foreground'
                              : 'font-medium'
                          }
                        >
                          {task.title}
                        </span>
                      </div>
                      {task.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-75">
                          {task.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/board/${task.boardId}`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {task.boardName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {task.columnName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-xs gap-1"
                      >
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${priorityConfig[task.priority].color}`}
                        />
                        {priorityConfig[task.priority].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.dueDate ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="size-3" />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEditTask(task)}
                          >
                            <Pencil className="mr-2 size-3" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/board/${task.boardId}`)
                            }
                          >
                            <Circle className="mr-2 size-3" />
                            Open Board
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            <Trash2 className="mr-2 size-3" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update task details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
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
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
