import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly realtime: RealtimeService,
  ) {}

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

    return this.prisma.task.create({
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
    }).then((task) => {
      this.realtime.emitTaskCreated(boardId, task);
      return task;
    });
  }

  async findAll(userId: string, boardId: string) {
    await this.permissions.validateBoardAccess(userId, boardId);

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
  }

  async findOne(id: string, userId: string) {
    await this.permissions.validateTaskAccess(userId, id);

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
    return task;
  }

  async update(id: string, userId: string, updateTaskDto: UpdateTaskDto) {
    await this.permissions.validateTaskAccess(userId, id);

    const { dueDate, ...rest } = updateTaskDto;
    const updateData: Record<string, any> = { ...rest };

    if (dueDate) {
      updateData['dueDate'] = new Date(dueDate as string | number | Date);
    }

    return this.prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        labels: true,
      },
    }).then((task) => {
      this.realtime.emitTaskUpdated(task.boardId, task);
      return task;
    });
  }

  async remove(id: string, userId: string) {
    await this.permissions.validateTaskAccess(userId, id);

    const task = await this.prisma.task.delete({
      where: { id },
    });
    this.realtime.emitTaskDeleted(task.boardId, task.id);
    return task;
  }
}
