import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import {
  CreateInviteLinkDto,
  UpdateMemberRoleDto,
} from './dto/create-invite-link.dto';
import { randomBytes } from 'node:crypto';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createWorkspaceDto: CreateWorkspaceDto) {
    const workspace = await this.prisma.workspace.create({
      data: {
        name: createWorkspaceDto.name,
        ownerId: userId,
        members: {
          create: {
            userId: userId,
            role: 'OWNER',
          },
        },
      },
    });
    return workspace;
  }

  async findAll(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    // Check if user is a member
    const isMember = workspace.members.some(
      (member) => member.userId === userId,
    );
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return workspace;
  }

  async update(
    id: string,
    userId: string,
    updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });

    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can update the workspace');
    }

    return this.prisma.workspace.update({
      where: { id },
      data: updateWorkspaceDto,
    });
  }

  async remove(id: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });

    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete the workspace');
    }

    return this.prisma.workspace.delete({
      where: { id },
    });
  }

  // ============================================
  // INVITE LINK MANAGEMENT
  // ============================================

  async createInviteLink(
    workspaceId: string,
    userId: string,
    dto: CreateInviteLinkDto,
  ) {
    await this.assertOwnerOrEditor(workspaceId, userId);

    const token = randomBytes(32).toString('hex');

    return this.prisma.workspaceInviteLink.create({
      data: {
        workspaceId,
        token,
        role: dto.role || 'EDITOR',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxUses: dto.maxUses || null,
        createdById: userId,
      },
    });
  }

  async getInviteLinks(workspaceId: string, userId: string) {
    await this.assertOwnerOrEditor(workspaceId, userId);

    return this.prisma.workspaceInviteLink.findMany({
      where: { workspaceId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInviteLink(linkId: string, userId: string) {
    const link = await this.prisma.workspaceInviteLink.findUnique({
      where: { id: linkId },
    });

    if (!link) throw new NotFoundException('Invite link not found');

    await this.assertOwnerOrEditor(link.workspaceId, userId);

    return this.prisma.workspaceInviteLink.update({
      where: { id: linkId },
      data: { isActive: false },
    });
  }

  async joinByInviteLink(token: string, userId: string) {
    const link = await this.prisma.workspaceInviteLink.findUnique({
      where: { token },
      include: {
        workspace: {
          select: { id: true, name: true },
        },
      },
    });

    if (!link) throw new NotFoundException('Invalid invite link');
    if (!link.isActive) {
      throw new BadRequestException('This invite link has been revoked');
    }
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new BadRequestException('This invite link has expired');
    }
    if (link.maxUses && link.useCount >= link.maxUses) {
      throw new BadRequestException(
        'This invite link has reached its maximum uses',
      );
    }

    // Check if already a member
    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: link.workspaceId,
          userId,
        },
      },
    });

    if (existingMember) {
      return { workspace: link.workspace, alreadyMember: true };
    }

    // Add member and increment use count in a transaction
    const [member] = await this.prisma.$transaction([
      this.prisma.workspaceMember.create({
        data: {
          workspaceId: link.workspaceId,
          userId,
          role: link.role === 'OWNER' ? 'EDITOR' : link.role,
        },
        include: {
          workspace: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.workspaceInviteLink.update({
        where: { id: link.id },
        data: { useCount: { increment: 1 } },
      }),
    ]);

    return { workspace: member.workspace, alreadyMember: false };
  }

  async getInviteLinkInfo(token: string) {
    const link = await this.prisma.workspaceInviteLink.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            _count: { select: { members: true } },
          },
        },
      },
    });

    if (!link) throw new NotFoundException('Invalid invite link');

    const isExpired = link.expiresAt ? link.expiresAt < new Date() : false;
    const isMaxedOut = link.maxUses ? link.useCount >= link.maxUses : false;

    return {
      workspaceName: link.workspace.name,
      role: link.role,
      isActive: link.isActive,
      isExpired,
      isMaxedOut,
      memberCount: link.workspace._count.members,
    };
  }

  // ============================================
  // MEMBER MANAGEMENT
  // ============================================

  async getMembers(workspaceId: string, userId: string) {
    await this.assertMemberAccess(workspaceId, userId);

    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
    });
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    userId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can change member roles');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'OWNER') {
      throw new ForbiddenException('Cannot change the owner role');
    }

    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async removeMember(workspaceId: string, memberId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    // Owner can remove anyone (except themselves), member can remove only themselves
    if (member.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove the workspace owner');
    }
    if (workspace.ownerId !== userId && member.userId !== userId) {
      throw new ForbiddenException('You can only remove yourself or must be the owner');
    }

    return this.prisma.workspaceMember.delete({
      where: { id: memberId },
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private async assertMemberAccess(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }
    return member;
  }

  private async assertOwnerOrEditor(workspaceId: string, userId: string) {
    const member = await this.assertMemberAccess(workspaceId, userId);
    if (member.role === 'VIEWER') {
      throw new ForbiddenException('Viewers cannot perform this action');
    }
    return member;
  }
}
