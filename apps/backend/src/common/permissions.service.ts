import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceMember } from '@prisma/client'; // Assuming WorkspaceMember is a Prisma client type

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async validateWorkspaceAccess(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMember> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException(
        'Access denied: You are not a member of this workspace',
      );
    }

    return member;
  }

  async validateBoardAccess(
    userId: string,
    boardId: string,
  ): Promise<WorkspaceMember> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { workspaceId: true },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    return this.validateWorkspaceAccess(userId, board.workspaceId);
  }

  async validateColumnAccess(
    userId: string,
    columnId: string,
  ): Promise<{ member: WorkspaceMember; boardId: string }> {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    const member = await this.validateBoardAccess(userId, column.boardId);
    return { member, boardId: column.boardId };
  }

  async validateTaskAccess(userId: string, taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { workspaceId: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.validateWorkspaceAccess(userId, task.workspaceId);
  }

  /**
   * Validate that a column belongs to the specified board.
   * Security: Prevents moving tasks to columns in different boards.
   */
  async validateColumnBelongsToBoard(
    columnId: string,
    boardId: string,
  ): Promise<void> {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    if (column.boardId !== boardId) {
      throw new ForbiddenException(
        'Invalid operation: Column does not belong to the task board',
      );
    }
  }

  /**
   * Validate that a user is a member of the workspace.
   * Security: Prevents assigning tasks to users outside the workspace.
   */
  async validateAssigneeInWorkspace(
    assigneeId: string,
    workspaceId: string,
  ): Promise<void> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: assigneeId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException(
        'Invalid assignee: User is not a member of this workspace',
      );
    }
  }
}
