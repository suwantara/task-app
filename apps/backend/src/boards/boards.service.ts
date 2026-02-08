import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { PermissionsService } from '../common/permissions.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly permissions: PermissionsService,
  ) {}

  private readonly getCacheKey = {
    boardsList: (workspaceId: string) => `boards:workspace:${workspaceId}`,
    board: (id: string) => `board:${id}`,
  } as const;

  async create(userId: string, createBoardDto: CreateBoardDto) {
    await this.permissions.validateWorkspaceAccess(userId, createBoardDto.workspaceId);

    const board = await this.prisma.board.create({
      data: {
        name: createBoardDto.name,
        workspaceId: createBoardDto.workspaceId,
        creatorId: userId,
        columns: {
          createMany: {
            data: [
              { name: 'To Do', position: 0 },
              { name: 'In Progress', position: 1 },
              { name: 'Done', position: 2 },
            ],
          },
        },
      },
      include: {
        columns: true,
      },
    });

    await this.cache.del(this.getCacheKey.boardsList(createBoardDto.workspaceId));

    return board;
  }

  async findAll(userId: string, workspaceId: string) {
    await this.permissions.validateWorkspaceAccess(userId, workspaceId);

    const cacheKey = this.getCacheKey.boardsList(workspaceId);
    return this.cache.getOrSet(cacheKey, () =>
      this.prisma.board.findMany({
        where: { workspaceId },
        include: { _count: { select: { tasks: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(id: string, userId: string) {
    const cacheKey = this.getCacheKey.board(id);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      const board = cached as {
        workspace: { members: { userId: string }[] };
      };
      if (board.workspace.members.some((m) => m.userId === userId)) return cached;
    }

    await this.permissions.validateBoardAccess(userId, id);

    const board = await this.prisma.board.findUnique({
      where: { id },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId },
              take: 1,
              select: { userId: true, role: true },
            },
          },
        },
        columns: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              orderBy: { position: 'asc' },
              include: {
                assignee: { select: { id: true, name: true, avatarUrl: true } },
                labels: true,
              },
            },
          },
        },
      },
    });

    if (!board) throw new NotFoundException('Board not found');

    await this.cache.set(cacheKey, board, 120);
    return board;
  }

  async update(id: string, userId: string, updateBoardDto: UpdateBoardDto) {
    const member = await this.permissions.validateBoardAccess(userId, id);

    const board = await this.prisma.board.findUnique({
      where: { id },
      select: { workspaceId: true },
    });
    if (!board) throw new NotFoundException('Board not found');

    const updated = await this.prisma.board.update({
      where: { id },
      data: { name: updateBoardDto.name },
    });

    await Promise.all([
      this.cache.del(this.getCacheKey.board(id)),
      this.cache.del(this.getCacheKey.boardsList(board.workspaceId)),
    ]);

    return updated;
  }

  async remove(id: string, userId: string) {
    const member = await this.permissions.validateBoardAccess(userId, id);

    const board = await this.prisma.board.findUnique({
      where: { id },
      select: {
        id: true,
        workspaceId: true,
        creatorId: true,
        workspace: { select: { ownerId: true } },
      },
    });

    if (!board) throw new NotFoundException('Board not found');

    // Only workspace owner or board creator can delete
    const isWorkspaceOwner = board.workspace.ownerId === userId;
    const isCreator = board.creatorId === userId;

    if (!isWorkspaceOwner && !isCreator) {
      throw new ForbiddenException(
        'Only board creator or workspace owner can delete',
      );
    }

    const deleted = await this.prisma.board.delete({
      where: { id },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.board(id)),
      this.cache.del(this.getCacheKey.boardsList(board.workspaceId)),
    ]);

    return deleted;
  }
}
