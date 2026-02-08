'use client';

import { useState, useMemo } from 'react';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { useWorkspace } from '@/contexts/workspace-context';
import { useRouter } from 'next/navigation';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { PRIORITY_CONFIG } from '@/lib/api';
import type { TaskPriority, Task } from '@/lib/api';
import { useAllWorkspaceTasks } from '@/hooks/use-queries';
import { PageLoading } from '@/components/page-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  const [currentMonth, setCurrentMonth] = useState(new Date());

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

  const today = new Date();
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const getPriorityColor = (priority: TaskPriority) => {
    return PRIORITY_CONFIG[priority]?.color || 'bg-gray-400';
  };

  if (authLoading || isLoading) {
    return <PageLoading />;
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
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
        <div className="flex flex-1 flex-col overflow-hidden">
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
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate.get(dateKey) || [];
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isToday = isSameDay(day, today);

                return (
                  <div
                    key={dateKey}
                    className={`min-h-[100px] border-b border-r p-1 ${
                      isCurrentMonth ? 'bg-background' : 'bg-muted/30'
                    }`}
                  >
                    <div className="mb-0.5 flex items-center justify-between px-1">
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
                      {dayTasks.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {dayTasks.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
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
          </ScrollArea>
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
    </div>
  );
}
