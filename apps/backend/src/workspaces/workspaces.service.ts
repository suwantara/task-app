import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import {
  CreateInviteLinkDto,
  UpdateMemberRoleDto,
} from './dto/create-invite-link.dto';
import { randomBytes } from 'node:crypto';

@Injectable()
export class WorkspacesService {
  /**
   * Generate a short, URL-friendly unique invite token (8 chars).
   * Uses base64url encoding for compact, safe output.
   * Retries on the (extremely rare) collision.
   */
  private async generateShortToken(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bytes = randomBytes(8);
      let token = '';
      for (let i = 0; i < 8; i++) {
        token += chars[bytes[i] % chars.length];
      }

      const existing = await this.prisma.workspaceInviteLink.findUnique({
        where: { token },
      });
      if (!existing) return token;
    }

    // Fallback: longer token to guarantee uniqueness
    return randomBytes(12).toString('base64url').slice(0, 12);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private readonly getCacheKey = {
    workspacesList: (userId: string) => `workspaces:user:${userId}`,
    workspace: (id: string) => `workspace:${id}`,
    members: (workspaceId: string) => `workspace:${workspaceId}:members`,
  };

  private generateJoinCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async create(userId: string, createWorkspaceDto: CreateWorkspaceDto) {
    const workspace = await this.prisma.workspace.create({
      data: {
        name: createWorkspaceDto.name,
        ownerId: userId,
        editorJoinCode: this.generateJoinCode(),
        viewerJoinCode: this.generateJoinCode(),
        members: {
          create: {
            userId: userId,
            role: 'OWNER',
          },
        },
      },
    });

    // Invalidate user's workspaces list cache
    await this.cache.del(this.getCacheKey.workspacesList(userId));

    return workspace;
  }

  async findAll(userId: string) {
    const cacheKey = this.getCacheKey.workspacesList(userId);
    return this.cache.getOrSet(cacheKey, async () => {
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
    });
  }

  async findOne(id: string, userId: string) {
    const cacheKey = this.getCacheKey.workspace(id);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      const workspace = cached as {
        members: { userId: string }[];
      };
      const isMember = workspace.members.some(
        (member) => member.userId === userId,
      );
      if (isMember) return cached;
    }

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

    await this.cache.set(cacheKey, workspace, 180);
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

    const updated = await this.prisma.workspace.update({
      where: { id },
      data: updateWorkspaceDto,
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.workspace(id)),
      this.cache.delPattern('workspaces:user:*'),
    ]);

    return updated;
  }

  async remove(id: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });

    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete the workspace');
    }

    const deleted = await this.prisma.workspace.delete({
      where: { id },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.workspace(id)),
      this.cache.delPattern('workspaces:user:*'),
    ]);

    return deleted;
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

    const token = await this.generateShortToken();

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

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.workspace(link.workspaceId)),
      this.cache.del(this.getCacheKey.members(link.workspaceId)),
      this.cache.del(this.getCacheKey.workspacesList(userId)),
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

    const cacheKey = this.getCacheKey.members(workspaceId);
    return this.cache.getOrSet(cacheKey, async () => {
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
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });
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
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'OWNER') {
      throw new ForbiddenException('Cannot change the owner role');
    }

    // 1. Optimistic Update to Redis
    const cacheKey = this.getCacheKey.members(workspaceId);
    const cachedMembers = (await this.cache.get(cacheKey)) as {
      id: string;
      role: string;
      [key: string]: unknown;
    }[] | null;

    if (cachedMembers) {
      const updatedMembers = cachedMembers.map((m) =>
        m.id === memberId ? { ...m, role: dto.role } : m,
      );
      await this.cache.set(cacheKey, updatedMembers);
    }

    // 2. Persist to Database
    const updated = await this.prisma.workspaceMember.update({
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

    // 3. Update cache with authoritative data
    if (cachedMembers) {
      const finalMembers = cachedMembers.map((m) =>
        m.id === memberId ? updated : m,
      );
      await this.cache.set(cacheKey, finalMembers);
    } else {
      await this.cache.del(cacheKey);
    }

    return updated;
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
      throw new ForbiddenException(
        'You can only remove yourself or must be the owner',
      );
    }

    const deleted = await this.prisma.workspaceMember.delete({
      where: { id: memberId },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.members(workspaceId)),
      this.cache.del(this.getCacheKey.workspace(workspaceId)),
      this.cache.del(this.getCacheKey.workspacesList(member.userId)),
    ]);

    return deleted;
  }

  // ============================================
  // JOIN CODE MANAGEMENT
  // ============================================

  async joinByCode(code: string, userId: string) {
    const normalizedCode = code.toUpperCase().trim();

    // Find workspace by either code
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        OR: [
          { editorJoinCode: normalizedCode },
          { viewerJoinCode: normalizedCode },
        ],
      },
    });

    if (!workspace) {
      throw new NotFoundException('Invalid join code');
    }

    // Check if already a member
    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException('You are already a member of this workspace');
    }

    // Determine role based on code used
    const role = workspace.editorJoinCode === normalizedCode ? 'EDITOR' : 'VIEWER';

    const member = await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role,
      },
      include: {
        workspace: true,
      },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.members(workspace.id)),
      this.cache.del(this.getCacheKey.workspace(workspace.id)),
      this.cache.del(this.getCacheKey.workspacesList(userId)),
    ]);

    return member;
  }

  async getJoinCodes(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Only owner can see join codes
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only the workspace owner can view join codes');
    }

    return {
      editorJoinCode: workspace.editorJoinCode,
      viewerJoinCode: workspace.viewerJoinCode,
    };
  }

  async regenerateJoinCode(
    workspaceId: string,
    role: 'EDITOR' | 'VIEWER',
    userId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only the workspace owner can regenerate codes');
    }

    const newCode = this.generateJoinCode();
    const updateData = role === 'EDITOR'
      ? { editorJoinCode: newCode }
      : { viewerJoinCode: newCode };

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData,
    });

    // Invalidate workspace cache
    await this.cache.del(this.getCacheKey.workspace(workspaceId));

    return { role, newCode };
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
