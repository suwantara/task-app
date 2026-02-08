import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private readonly getCacheKey = {
    boardsList: (workspaceId: string) => `boards:workspace:${workspaceId}`,
    board: (id: string) => `board:${id}`,
  };

  async create(userId: string, createBoardDto: CreateBoardDto) {
    // Verify user is member of workspace
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: createBoardDto.workspaceId,
          userId: userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

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

    // Invalidate boards list cache
    await this.cache.del(
      this.getCacheKey.boardsList(createBoardDto.workspaceId),
    );

    return board;
  }

  async findAll(userId: string, workspaceId: string) {
    // Verify access
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceId,
          userId: userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    // Try cache first
    const cacheKey = this.getCacheKey.boardsList(workspaceId);
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.board.findMany({
        where: { workspaceId },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async findOne(id: string, userId: string) {
    // Try cache first
    const cacheKey = this.getCacheKey.board(id);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      // Verify access on cached data
      const board = cached as {
        workspace: { members: { userId: string }[] };
      };
      const isMember = board.workspace.members.some((m) => m.userId === userId);
      if (isMember) return cached;
    }

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
                assignee: {
                  select: { id: true, name: true, avatarUrl: true },
                },
                labels: true,
              },
            },
          },
        },
      },
    });

    if (!board) {
      throw new NotFoundException(`Board with ID ${id} not found`);
    }

    // Check access
    if (!board.workspace.members[0]) {
      throw new ForbiddenException('You do not have access to this board');
    }

    // Cache the result (shorter TTL for detailed data)
    await this.cache.set(cacheKey, board, 120);

    return board;
  }

  async update(id: string, userId: string, updateBoardDto: UpdateBoardDto) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            members: { where: { userId }, take: 1, select: { userId: true } },
          },
        },
      },
    });

    if (!board) throw new NotFoundException('Board not found');

    if (!board.workspace.members[0]) throw new ForbiddenException('Access denied');

    const updated = await this.prisma.board.update({
      where: { id },
      data: { name: updateBoardDto.name },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.board(id)),
      this.cache.del(this.getCacheKey.boardsList(board.workspaceId)),
    ]);

    return updated;
  }

  async remove(id: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      select: {
        id: true,
        workspaceId: true,
        creatorId: true,
        workspace: {
          select: {
            ownerId: true,
            members: { where: { userId }, take: 1, select: { userId: true } },
          },
        },
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
