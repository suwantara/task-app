import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly realtime: RealtimeService,
  ) {}

  private readonly getCacheKey = {
    notesList: (workspaceId: string) => `notes:workspace:${workspaceId}`,
    note: (id: string) => `note:${id}`,
  };

  async create(userId: string, createNoteDto: CreateNoteDto) {
    // Verify workspace access
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: createNoteDto.workspaceId,
          userId: userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const note = await this.prisma.note.create({
      data: {
        title: createNoteDto.title,
        content: createNoteDto.content || '',
        icon: createNoteDto.emoji, // Map emoji DTO to icon DB field
        workspaceId: createNoteDto.workspaceId,
        creatorId: userId,
        parentId: createNoteDto.parentId,
      },
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    // Invalidate notes list cache
    await this.cache.del(this.getCacheKey.notesList(createNoteDto.workspaceId));

    return note;
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
    const cacheKey = this.getCacheKey.notesList(workspaceId);
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.note.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: 'desc' },
        include: {
          creator: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });
    });
  }

  async findOne(id: string, userId: string) {
    // Try cache first
    const cacheKey = this.getCacheKey.note(id);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      const note = cached as {
        workspace: { members: { userId: string }[] };
      };
      const isMember = note.workspace.members.some((m) => m.userId === userId);
      if (isMember) return cached;
    }

    const note = await this.prisma.note.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true },
        },
        workspace: {
          include: { members: true },
        },
      },
    });

    if (!note) throw new NotFoundException('Note not found');

    const isMember = note.workspace.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Access denied');

    // Cache the result
    await this.cache.set(cacheKey, note, 120);

    return note;
  }

  async update(id: string, userId: string, updateNoteDto: UpdateNoteDto) {
    const note = await this.prisma.note.findUnique({
      where: { id },
      include: { workspace: { include: { members: true } } },
    });

    if (!note) throw new NotFoundException('Note not found');

    const isMember = note.workspace.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Access denied');

    const updated = await this.prisma.note.update({
      where: { id },
      data: updateNoteDto,
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.note(id)),
      this.cache.del(this.getCacheKey.notesList(note.workspaceId)),
    ]);

    this.realtime.emitNoteUpdated(note.workspaceId, updated);
    return updated;
  }

  async remove(id: string, userId: string) {
    const note = await this.prisma.note.findUnique({
      where: { id },
      include: { workspace: { include: { members: true } } },
    });

    if (!note) throw new NotFoundException('Note not found');

    const isMember = note.workspace.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Access denied');

    const deleted = await this.prisma.note.delete({
      where: { id },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.note(id)),
      this.cache.del(this.getCacheKey.notesList(note.workspaceId)),
    ]);

    return deleted;
  }
}
