'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { useWorkspace } from '@/contexts/workspace-context';
import { useRouter } from 'next/navigation';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { PRIORITY_CONFIG } from '@/lib/api';
import type { TaskPriority, Task } from '@/lib/api';
import { useAllWorkspaceTasks, useCreateTask } from '@/hooks/use-queries';
import { useHolidays } from '@/hooks/use-holidays';
import type { Holiday } from '@/lib/holidays';
import { PageLoading } from '@/components/page-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Circle,
  Plus,
  Star,
} from 'lucide-react';

interface TaskWithBoard extends Task {
  readonly boardName?: string;
  readonly columnName?: string;
}

export default function CalendarPage() {
  const { loading: authLoading } = useAuthGuard();
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();
  const workspaceId = activeWorkspace?.id || '';

  const { data, isLoading } = useAllWorkspaceTasks(workspaceId);
  const createTask = useCreateTask();
  const { holidayMap } = useHolidays();

  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date: Date } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Add Task dialog state
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskDate, setAddTaskDate] = useState<Date | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskBoardId, setTaskBoardId] = useState('');
  const [taskColumnId, setTaskColumnId] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('MEDIUM');

  const availableBoards = useMemo(() => data?.boards ?? [], [data]);
  const availableColumns = useMemo(() => {
    if (!taskBoardId) return [];
    const found = data?.boardResults?.find((r: { board: { id: string } }) => r.board.id === taskBoardId);
    return (found?.columns ?? []) as { id: string; name: string }[];
  }, [data, taskBoardId]);

  const handleDayContextMenu = useCallback((e: React.MouseEvent, day: Date) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, date: day });
  }, []);

  const openAddTaskDialog = useCallback((date: Date) => {
    setAddTaskDate(date);
    setTaskTitle('');
    setTaskDescription('');
    setTaskBoardId(availableBoards[0]?.id ?? '');
    setTaskColumnId('');
    setTaskPriority('MEDIUM');
    setAddTaskOpen(true);
    setContextMenu(null);
  }, [availableBoards]);

  const handleAddTaskSubmit = useCallback(async () => {
    if (!taskTitle.trim() || !taskBoardId || !taskColumnId) return;
    await createTask.mutateAsync({
      workspaceId,
      boardId: taskBoardId,
      columnId: taskColumnId,
      title: taskTitle.trim(),
      description: taskDescription.trim() || undefined,
      priority: taskPriority,
      position: 0,
      ...(addTaskDate ? { dueDate: format(addTaskDate, 'yyyy-MM-dd') } : {}),
    } as Parameters<typeof createTask.mutateAsync>[0]);
    setAddTaskOpen(false);
  }, [taskTitle, taskBoardId, taskColumnId, taskDescription, taskPriority, addTaskDate, workspaceId, createTask]);

  // Close context menu on outside click
  const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

  // Flatten tasks and add board/column names
  const allTasks: TaskWithBoard[] = useMemo(() => {
    if (!data?.boardResults) return [];
    return data.boardResults.flatMap(({ board, columns, tasks }) =>
      (tasks as Task[]).map((task) => ({
        ...task,
        boardName: board.name,
        columnName: (columns as { id: string; name: string }[]).find(
          (c) => c.id === task.columnId,
        )?.name,
      })),
    );
  }, [data]);

  // Tasks with due dates grouped by date string
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithBoard[]>();
    for (const task of allTasks) {
      if (!task.dueDate) continue;
      const key = format(new Date(task.dueDate), 'yyyy-MM-dd');
      const existing = map.get(key) || [];
      existing.push(task);
      map.set(key, existing);
    }
    return map;
  }, [allTasks]);

  // Tasks without due date
  const unscheduledTasks = useMemo(
    () => allTasks.filter((t) => !t.dueDate),
    [allTasks],
  );

  // Calendar grid days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const prevMonth = () =>
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setCurrentMonth(new Date());

  // Holidays in the currently viewed month, sorted by date
  const monthHolidays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const results: { date: string; name: string; type: Holiday['type'] }[] = [];
    for (const [dateKey, holidays] of holidayMap.entries()) {
      const d = new Date(dateKey);
      if (d.getFullYear() === year && d.getMonth() === month) {
        for (const h of holidays) results.push(h);
      }
    }
    return results.sort((a, b) => a.date.localeCompare(b.date));
  }, [currentMonth, holidayMap]);

  const today = new Date();
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const getPriorityColor = (priority: TaskPriority) => {
    return PRIORITY_CONFIG[priority]?.color || 'bg-gray-400';
  };

  const getHolidayBadgeClass = (type: Holiday['type']) => {
    switch (type) {
      case 'national': return 'bg-red-500/15 text-red-600 dark:text-red-400';
      case 'joint-leave': return 'bg-orange-400/15 text-orange-600 dark:text-orange-400';
      case 'balinese': return 'bg-yellow-400/15 text-yellow-700 dark:text-yellow-400';
    }
  };

  if (authLoading || isLoading) {
    return <PageLoading />;
  }

  return (
    <div className="flex h-full flex-col" onClick={handleCloseContextMenu} onKeyDown={(e) => e.key === 'Escape' && handleCloseContextMenu()} role="none">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Calendar</h1>
          <span className="text-sm text-muted-foreground">
            {activeWorkspace?.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={prevMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <Button variant="ghost" size="icon" className="size-8" onClick={nextMonth}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar Grid */}
        <div className="flex flex-1 flex-col overflow-auto">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b">
            {weekDays.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="flex-1">
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate.get(dateKey) || [];
                const dayHolidays = holidayMap.get(dateKey) || [];
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isToday = isSameDay(day, today);
                const hasHoliday = dayHolidays.length > 0;

                return (
                  <div
                    key={dateKey}
                    className={`group relative min-h-[100px] cursor-default border-b border-r p-1 ${
                      hasHoliday && isCurrentMonth
                        ? 'bg-red-50/40 dark:bg-red-950/10'
                        : isCurrentMonth
                          ? 'bg-background'
                          : 'bg-muted/30'
                    }`}
                    onContextMenu={(e) => handleDayContextMenu(e, day)}
                    onKeyDown={(e) => e.key === 'Enter' && openAddTaskDialog(day)}
                    onClick={(e) => e.stopPropagation()}
                    tabIndex={0}
                    role="button"
                    aria-label={format(day, 'MMMM d, yyyy')}
                  >
                    <div className="mb-0.5 flex items-center justify-between px-1">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs font-medium ${
                            isToday
                              ? 'flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground'
                              : isCurrentMonth
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {format(day, 'd')}
                        </span>
                        {hasHoliday && isCurrentMonth && (
                          <Star className="size-2.5 fill-current text-yellow-500" />
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); openAddTaskDialog(day); }}
                        className="hidden size-4 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:flex group-hover:opacity-100"
                        title="Add task"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {dayHolidays.map((holiday) => (
                        <Tooltip key={`${holiday.date}-${holiday.name}`}>
                          <TooltipTrigger asChild>
                            <div
                              className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight font-medium ${
                                getHolidayBadgeClass(holiday.type)
                              }`}
                            >
                              {holiday.name}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[220px]">
                            <p className="font-medium">{holiday.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {holiday.type === 'national' && 'Hari Libur Nasional'}
                              {holiday.type === 'joint-leave' && 'Cuti Bersama'}
                              {holiday.type === 'balinese' && 'Hari Raya Bali'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {dayTasks.slice(0, 3).map((task) => (
                        <Tooltip key={task.id}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => router.push(`/board/${task.boardId}`)}
                              className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-accent"
                            >
                              <Circle
                                className={`size-2 shrink-0 fill-current ${getPriorityColor(task.priority)}`}
                              />
                              <span className="truncate">{task.title}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[200px]">
                            <p className="font-medium">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.boardName} &middot; {task.columnName}
                            </p>
                            <Badge
                              variant="outline"
                              className="mt-1 text-[10px]"
                            >
                              {task.priority}
                            </Badge>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {dayTasks.length > 3 && (
                        <p className="px-1 text-[10px] text-muted-foreground">
                          +{dayTasks.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Holidays this month */}
          {monthHolidays.length > 0 && (
            <div className="border-t">
              <div className="px-6 py-3">
                <h3 className="mb-2 text-sm font-semibold">
                  Hari Penting — {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                  {monthHolidays.map((h) => {
                    let dotColor = 'bg-yellow-500';
                    let typeName = 'Hari Raya Bali';
                    if (h.type === 'national') { dotColor = 'bg-red-500'; typeName = 'Libur Nasional'; }
                    else if (h.type === 'joint-leave') { dotColor = 'bg-orange-400'; typeName = 'Cuti Bersama'; }
                    return (
                      <div
                        key={`${h.date}-${h.name}`}
                        className="flex items-start gap-2 py-1"
                      >
                        <div className={`mt-1 size-2 shrink-0 rounded-full ${dotColor}`} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{h.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(h.date), 'EEE, d MMM')}
                            {' · '}
                            {typeName}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Unscheduled sidebar */}
        <div className="flex w-60 shrink-0 flex-col border-l">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Unscheduled</h3>
            <p className="text-xs text-muted-foreground">
              {unscheduledTasks.length} task{unscheduledTasks.length === 1 ? '' : 's'}
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              {unscheduledTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => router.push(`/board/${task.boardId}`)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
                >
                  <Circle
                    className={`mt-0.5 size-2.5 shrink-0 fill-current ${getPriorityColor(task.priority)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{task.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {task.boardName}
                    </p>
                  </div>
                </button>
              ))}
              {unscheduledTasks.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  All tasks are scheduled
                </p>
              )}
            </div>
          </ScrollArea>

        </div>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[150px] overflow-hidden rounded-md border bg-popover py-1 shadow-md"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseContextMenu()}
          tabIndex={-1}
          role="menu"
          aria-label="Date options"
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
            onClick={() => openAddTaskDialog(contextMenu.date)}
          >
            <Plus className="size-3.5" />
            Add Task on {format(contextMenu.date, 'MMM d')}
          </button>
        </div>
      )}

      {/* Add Task Dialog */}
      <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              Add Task — {addTaskDate ? format(addTaskDate, 'MMMM d, yyyy') : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="task-title"
                placeholder="Task title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                placeholder="Optional description…"
                rows={3}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Board <span className="text-destructive">*</span></Label>
                <Select
                  value={taskBoardId}
                  onValueChange={(v) => { setTaskBoardId(v); setTaskColumnId(''); }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select board" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBoards.map((b: { id: string; name: string }) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Column <span className="text-destructive">*</span></Label>
                <Select
                  value={taskColumnId}
                  onValueChange={setTaskColumnId}
                  disabled={!taskBoardId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as TaskPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddTaskSubmit}
              disabled={!taskTitle.trim() || !taskBoardId || !taskColumnId || createTask.isPending}
            >
              {createTask.isPending ? 'Adding…' : 'Add Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
