import { Injectable, NotFoundException } from '@nestjs/common';
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

    // Invalidate board cache (contains tasks via columns)
    await this.cache.del(`board:${boardId}`);

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

    const { dueDate, ...rest } = updateTaskDto;
    const updateData: Record<string, unknown> = { ...rest };

    if (dueDate) {
      updateData['dueDate'] = new Date(dueDate as string | number | Date);
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        labels: true,
      },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.task(id)),
      this.cache.del(`board:${task.boardId}`),
    ]);

    this.realtime.emitTaskUpdated(task.boardId, task);
    return task;
  }

  async remove(id: string, userId: string) {
    await this.permissions.validateTaskAccess(userId, id);

    const task = await this.prisma.task.delete({
      where: { id },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.task(id)),
      this.cache.del(`board:${task.boardId}`),
    ]);

    this.realtime.emitTaskDeleted(task.boardId, task.id);
    return task;
  }
}
