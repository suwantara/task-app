import { Injectable, NotFoundException } from '@nestjs/common';
import { Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { PermissionsService } from '../common/permissions.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly permissions: PermissionsService,
    private readonly realtime: RealtimeService,
  ) {}

  private readonly getCacheKey = {
    tasksList: (boardId: string) => `tasks:board:${boardId}`,
    task: (id: string) => `task:${id}`,
  };

  async create(userId: string, createTaskDto: CreateTaskDto) {
    const { member, boardId } = await this.permissions.validateColumnAccess(
      userId,
      createTaskDto.columnId,
    );

    // SECURITY: Validate assigneeId is a workspace member
    if (createTaskDto.assigneeId) {
      await this.permissions.validateAssigneeInWorkspace(
        createTaskDto.assigneeId,
        member.workspaceId,
      );
    }

    // Calculate position
    let position = createTaskDto.order;
    if (position === undefined) {
      const lastTask = await this.prisma.task.findFirst({
        where: { columnId: createTaskDto.columnId },
        orderBy: { position: 'desc' },
      });
      position = lastTask ? lastTask.position + 1 : 0;
    }

    const task = await this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        description: createTaskDto.description,
        columnId: createTaskDto.columnId,
        position: position,
        priority: createTaskDto.priority || 'MEDIUM',
        dueDate: createTaskDto.dueDate ? new Date(createTaskDto.dueDate) : null,
        assigneeId: createTaskDto.assigneeId,
        creatorId: userId,
        boardId,
        workspaceId: member.workspaceId,
      },
      include: {
        assignee: {
          select: { id: true, name: true, avatarUrl: true },
        },
        labels: true,
      },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.tasksList(boardId)),
      this.cache.del(`board:${boardId}`),
    ]);

    this.realtime.emitTaskCreated(boardId, task);
    return task;
  }

  async findAll(userId: string, boardId: string) {
    await this.permissions.validateBoardAccess(userId, boardId);

    const cacheKey = this.getCacheKey.tasksList(boardId);
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.task.findMany({
        where: { boardId },
        orderBy: { position: 'asc' },
        include: {
          assignee: {
            select: { id: true, name: true, avatarUrl: true },
          },
          labels: true,
        },
      });
    });
  }

  async findOne(id: string, userId: string) {
    await this.permissions.validateTaskAccess(userId, id);

    const cacheKey = this.getCacheKey.task(id);
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        workspace: { include: { members: true } },
        assignee: {
          select: { id: true, name: true, avatarUrl: true },
        },
        labels: true,
      },
    });

    if (!task) throw new NotFoundException('Task not found');

    await this.cache.set(cacheKey, task, 120);
    return task;
  }

  async update(id: string, userId: string, updateTaskDto: UpdateTaskDto) {
    await this.permissions.validateTaskAccess(userId, id);

    // 1. Fetch current task to get boardId if not in cache (needed for keys)
    // We try cache first for speed
    const cacheKey = this.getCacheKey.task(id);
    let task = await this.cache.get<Task>(cacheKey);

    task ??= await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        labels: true,
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    const boardId = task.boardId;
    const workspaceId = task.workspaceId;

    // SECURITY: Validate columnId belongs to the same board
    if (updateTaskDto.columnId && updateTaskDto.columnId !== task.columnId) {
      await this.permissions.validateColumnBelongsToBoard(
        updateTaskDto.columnId,
        boardId,
      );
    }

    // SECURITY: Validate assigneeId is a workspace member
    if (
      updateTaskDto.assigneeId &&
      updateTaskDto.assigneeId !== task.assigneeId
    ) {
      await this.permissions.validateAssigneeInWorkspace(
        updateTaskDto.assigneeId,
        workspaceId,
      );
    }

    // 2. Prepare update data
    const { dueDate, ...rest } = updateTaskDto;
    const updateData: Record<string, unknown> = { ...rest };
    if (dueDate) {
      updateData['dueDate'] = new Date(dueDate as string | number | Date);
    }

    // 3. Optimistic Update to Redis
    const updatedTaskOptimistic = {
      ...task,
      ...updateData,
      updatedAt: new Date(),
    };

    // Update individual task cache
    await this.cache.set(cacheKey, updatedTaskOptimistic, 120);

    // Update list cache (find and replace in array)
    const listCacheKey = this.getCacheKey.tasksList(boardId);
    const cachedList = await this.cache.get<Task[]>(listCacheKey);
    if (cachedList) {
      const updatedList = cachedList.map((t) =>
        t.id === id ? { ...t, ...updatedTaskOptimistic } : t,
      );
      await this.cache.set(listCacheKey, updatedList);
    }

    // 4. Broadcast immediately
    this.realtime.emitTaskUpdated(boardId, updatedTaskOptimistic);

    // 5. Persist to Database
    const finalTask = await this.prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        labels: true,
      },
    });

    // 6. Update Redis again with authoritative DB data (eventual consistency)
    await this.cache.set(cacheKey, finalTask, 120);

    // We can choose to invalidate list or update it again.
    // Updating provides better continuity.
    if (cachedList) {
      const finalList = cachedList.map((t) => (t.id === id ? finalTask : t));
      await this.cache.set(listCacheKey, finalList);
    } else {
      // If list wasn't cached, good opportunity to invalidate just in case
      await this.cache.del(listCacheKey);
    }
    await this.cache.del(`board:${boardId}`); // Invalidate board cache conservatively

    return finalTask;
  }

  async remove(id: string, userId: string) {
    await this.permissions.validateTaskAccess(userId, id);

    const task = await this.prisma.task.delete({
      where: { id },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.task(id)),
      this.cache.del(this.getCacheKey.tasksList(task.boardId)),
      this.cache.del(`board:${task.boardId}`),
    ]);

    this.realtime.emitTaskDeleted(task.boardId, task.id);
    return task;
  }
}
