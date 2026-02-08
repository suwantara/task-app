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

    // Broadcast creation so other clients update in realtime
    this.realtime.emitNoteCreated(createNoteDto.workspaceId, note);

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
    if (cached) return cached;

    const note = await this.prisma.note.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true },
        },
        workspace: {
          select: {
            members: {
              where: { userId },
              take: 1,
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!note) throw new NotFoundException('Note not found');

    if (!note.workspace.members[0]) throw new ForbiddenException('Access denied');

    // Cache the result
    await this.cache.set(cacheKey, note, 120);

    return note;
  }

  async update(id: string, userId: string, updateNoteDto: UpdateNoteDto) {
    // Fetch current state with filtered member check
    const note = await this.prisma.note.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        workspace: {
          select: {
            members: {
              where: { userId },
              take: 1,
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!note) throw new NotFoundException('Note not found');

    if (!note.workspace.members[0]) throw new ForbiddenException('Access denied');

    // 1. Optimistic Update & Save to Redis immediately
    const optimisticNote = {
      ...note,
      ...updateNoteDto,
      updatedAt: new Date(),
    };
    await this.cache.set(this.getCacheKey.note(id), optimisticNote);

    // 2. Broadcast to other users immediately
    this.realtime.emitNoteUpdated(note.workspaceId, optimisticNote);

    // 3. Persist to Database (no need to include workspace.members in response)
    const updated = await this.prisma.note.update({
      where: { id },
      data: updateNoteDto,
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // 4. Update cache with authoritative DB result
    await this.cache.set(this.getCacheKey.note(id), updated);

    // Invalidate list cache
    await this.cache.del(this.getCacheKey.notesList(note.workspaceId));

    return updated;
  }

  async remove(id: string, userId: string) {
    const note = await this.prisma.note.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            members: {
              where: { userId },
              take: 1,
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!note) throw new NotFoundException('Note not found');

    if (!note.workspace.members[0]) throw new ForbiddenException('Access denied');

    const deleted = await this.prisma.note.delete({
      where: { id },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.del(this.getCacheKey.note(id)),
      this.cache.del(this.getCacheKey.notesList(note.workspaceId)),
    ]);

    // Broadcast deletion so other clients update in realtime
    this.realtime.emitNoteDeleted(note.workspaceId, id);

    return deleted;
  }
}
