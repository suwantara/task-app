import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { PermissionsService } from '../common/permissions.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly permissions: PermissionsService,
    private readonly realtime: RealtimeService,
  ) {}

  private readonly getCacheKey = {
    notesList: (workspaceId: string) => `notes:workspace:${workspaceId}`,
    note: (id: string) => `note:${id}`,
    docBuffer: (id: string) => `doc_buffer:${id}`,
  } as const;

  async create(userId: string, createNoteDto: CreateNoteDto) {
    await this.permissions.validateWorkspaceAccess(userId, createNoteDto.workspaceId);

    const note = await this.prisma.note.create({
      data: {
        title: createNoteDto.title,
        content: createNoteDto.content || '',
        icon: createNoteDto.emoji,
        workspaceId: createNoteDto.workspaceId,
        creatorId: userId,
        parentId: createNoteDto.parentId,
      },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    await this.cache.del(this.getCacheKey.notesList(createNoteDto.workspaceId));
    this.realtime.emitNoteCreated(createNoteDto.workspaceId, note);

    return note;
  }

  async findAll(userId: string, workspaceId: string) {
    await this.permissions.validateWorkspaceAccess(userId, workspaceId);

    const cacheKey = this.getCacheKey.notesList(workspaceId);
    return this.cache.getOrSet(cacheKey, () =>
      this.prisma.note.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: 'desc' },
        include: {
          creator: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
    );
  }

  async findOne(id: string, userId: string) {
    const cacheKey = this.getCacheKey.note(id);
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    await this.permissions.validateNoteAccess(userId, id);

    const note = await this.prisma.note.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!note) throw new NotFoundException('Note not found');

    await this.cache.set(cacheKey, note, 120);
    return note;
  }

  async update(id: string, userId: string, updateNoteDto: UpdateNoteDto) {
    const { workspaceId } = await this.permissions.validateNoteAccess(userId, id);

    // Step 1: Write to Redis buffer for crash safety
    await this.cache.set(this.getCacheKey.docBuffer(id), updateNoteDto, 300);

    // Step 2: Persist to PostgreSQL via Prisma (source of truth)
    const updated = await this.prisma.note.update({
      where: { id },
      data: updateNoteDto,
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // Step 3: Update authoritative cache & clear buffer
    await Promise.all([
      this.cache.set(this.getCacheKey.note(id), updated),
      this.cache.del(this.getCacheKey.notesList(workspaceId)),
      this.cache.del(this.getCacheKey.docBuffer(id)),
    ]);

    // Step 4: Broadcast to other users ONLY after successful DB persist
    this.realtime.emitNoteUpdated(workspaceId, updated);

    return updated;
  }

  async remove(id: string, userId: string) {
    const { workspaceId } = await this.permissions.validateNoteAccess(userId, id);

    const deleted = await this.prisma.note.delete({ where: { id } });

    await Promise.all([
      this.cache.del(this.getCacheKey.note(id)),
      this.cache.del(this.getCacheKey.notesList(workspaceId)),
    ]);

    this.realtime.emitNoteDeleted(workspaceId, id);
    return deleted;
  }
}
