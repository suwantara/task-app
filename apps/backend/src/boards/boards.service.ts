import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

@Injectable()
export class BoardsService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.board.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      include: {
        workspace: {
          include: {
            members: true,
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
    const isMember = board.workspace.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You do not have access to this board');
    }

    return board;
  }

  async update(id: string, userId: string, updateBoardDto: UpdateBoardDto) {
    // Basic check - anyone in workspace can update? Or just owner/creator?
    // For MVP, enable workspace members to update.
    const board = await this.prisma.board.findUnique({
      where: { id },
      include: { workspace: { include: { members: true } } },
    });

    if (!board) throw new NotFoundException('Board not found');

    const isMember = board.workspace.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Access denied');

    return this.prisma.board.update({
      where: { id },
      data: { name: updateBoardDto.name },
    });
  }

  async remove(id: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      include: { workspace: { include: { members: true } } },
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

    return this.prisma.board.delete({
      where: { id },
    });
  }
}
