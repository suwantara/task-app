import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceMember } from '@prisma/client';

const ERR = {
  NOT_MEMBER: 'Access denied: You are not a member of this workspace',
  BOARD_NOT_FOUND: 'Board not found',
  COLUMN_NOT_FOUND: 'Column not found',
  TASK_NOT_FOUND: 'Task not found',
  NOTE_NOT_FOUND: 'Note not found',
} as const;

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
      throw new ForbiddenException(ERR.NOT_MEMBER);
    }

    return member;
  }

  /**
   * Single-query board access check — fetches board + verifies membership in one round-trip.
   */
  async validateBoardAccess(
    userId: string,
    boardId: string,
  ): Promise<WorkspaceMember> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        workspaceId: true,
        workspace: {
          select: {
            members: {
              where: { userId },
              take: 1,
            },
          },
        },
      },
    });

    if (!board) {
      throw new NotFoundException(ERR.BOARD_NOT_FOUND);
    }

    const member = board.workspace.members[0];
    if (!member) {
      throw new ForbiddenException(ERR.NOT_MEMBER);
    }

    return member;
  }

  /**
   * Single-query column access check — fetches column → board → membership in one round-trip.
   */
  async validateColumnAccess(
    userId: string,
    columnId: string,
  ): Promise<{ member: WorkspaceMember; boardId: string }> {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: {
        boardId: true,
        board: {
          select: {
            workspaceId: true,
            workspace: {
              select: {
                members: {
                  where: { userId },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!column) {
      throw new NotFoundException(ERR.COLUMN_NOT_FOUND);
    }

    const member = column.board.workspace.members[0];
    if (!member) {
      throw new ForbiddenException(ERR.NOT_MEMBER);
    }

    return { member, boardId: column.boardId };
  }

  /**
   * Single-query task access check — fetches task + membership in one round-trip.
   */
  async validateTaskAccess(
    userId: string,
    taskId: string,
  ): Promise<{ workspaceId: string; boardId: string }> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        workspaceId: true,
        boardId: true,
        workspace: {
          select: {
            members: {
              where: { userId },
              take: 1,
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(ERR.TASK_NOT_FOUND);
    }

    if (!task.workspace.members[0]) {
      throw new ForbiddenException(ERR.NOT_MEMBER);
    }

    return { workspaceId: task.workspaceId, boardId: task.boardId };
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
      throw new NotFoundException(ERR.COLUMN_NOT_FOUND);
    }

    if (column.boardId !== boardId) {
      throw new ForbiddenException(
        'Invalid operation: Column does not belong to the task board',
      );
    }
  }

  /**
   * Single-query note access check — fetches note + verifies membership in one round-trip.
   */
  async validateNoteAccess(
    userId: string,
    noteId: string,
  ): Promise<{ workspaceId: string }> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: {
        workspaceId: true,
        workspace: {
          select: {
            members: {
              where: { userId },
              take: 1,
            },
          },
        },
      },
    });

    if (!note) {
      throw new NotFoundException(ERR.NOTE_NOT_FOUND);
    }

    if (!note.workspace.members[0]) {
      throw new ForbiddenException(ERR.NOT_MEMBER);
    }

    return { workspaceId: note.workspaceId };
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
