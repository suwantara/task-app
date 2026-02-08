import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { PermissionsService } from '../common/permissions.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class NotesService implements OnModuleDestroy {
  private readonly logger = new Logger(NotesService.name);

  /** Deferred DB write timers keyed by noteId */
  private readonly dbFlushTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly DB_FLUSH_DELAY = 10_000; // 10 seconds after last update

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly permissions: PermissionsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Flush all pending DB writes on shutdown */
  async onModuleDestroy() {
    const promises: Promise<void>[] = [];
    for (const [noteId, timer] of this.dbFlushTimers.entries()) {
      clearTimeout(timer);
      promises.push(this.flushToDatabase(noteId));
    }
    await Promise.allSettled(promises);
  }

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

    // Merge with pending Redis buffer (buffer may be ahead of DB)
    const buffer = await this.cache.get<Record<string, unknown>>(this.getCacheKey.docBuffer(id));
    if (buffer) {
      const { workspaceId: _ws, ...bufferData } = buffer;
      const result = { ...note, ...bufferData };
      await this.cache.set(cacheKey, result, 120);
      return result;
    }

    await this.cache.set(cacheKey, note, 120);
    return note;
  }

  async update(id: string, userId: string, updateNoteDto: UpdateNoteDto) {
    const { workspaceId } = await this.permissions.validateNoteAccess(userId, id);
    const now = new Date().toISOString();

    // Step 1: Merge with existing buffer & save to Redis (crash-safe, fast)
    const bufferKey = this.getCacheKey.docBuffer(id);
    const existingBuffer = await this.cache.get<Record<string, unknown>>(bufferKey);
    const mergedBuffer = existingBuffer
      ? { ...existingBuffer, ...updateNoteDto, workspaceId }
      : { ...updateNoteDto, workspaceId };
    await this.cache.set(bufferKey, mergedBuffer, 600); // 10 min TTL

    // Step 2: Update note read-cache optimistically
    const noteCache = this.getCacheKey.note(id);
    const cached = await this.cache.get<Record<string, unknown>>(noteCache);
    const optimistic = cached
      ? { ...cached, ...updateNoteDto, updatedAt: now }
      : { id, ...updateNoteDto, updatedAt: now };
    await this.cache.set(noteCache, optimistic);

    // Step 3: Broadcast to other users IMMEDIATELY (fast path)
    this.realtime.emitNoteUpdated(workspaceId, { id, ...updateNoteDto, updatedAt: now });

    // Step 4: Schedule deferred DB persistence
    this.scheduleDatabaseFlush(id, workspaceId);

    return optimistic;
  }

  /**
   * Schedule a deferred write from Redis buffer to PostgreSQL.
   * Timer resets on each call, so rapid edits batch into one DB write.
   */
  private scheduleDatabaseFlush(noteId: string, workspaceId: string): void {
    const existing = this.dbFlushTimers.get(noteId);
    if (existing) clearTimeout(existing);

    this.dbFlushTimers.set(
      noteId,
      setTimeout(() => void this.flushToDatabase(noteId, workspaceId), this.DB_FLUSH_DELAY),
    );
  }

  /** Flush a single note's Redis buffer to PostgreSQL */
  private async flushToDatabase(noteId: string, workspaceId?: string): Promise<void> {
    try {
      const bufferKey = this.getCacheKey.docBuffer(noteId);
      const buffered = await this.cache.get<Record<string, unknown>>(bufferKey);
      if (!buffered) {
        this.dbFlushTimers.delete(noteId);
        return;
      }

      const wsId = workspaceId || (buffered.workspaceId as string);
      // Remove workspaceId — it's metadata, not a note field to update
      const { workspaceId: _ws, ...data } = buffered;

      const updated = await this.prisma.note.update({
        where: { id: noteId },
        data,
        include: {
          creator: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      // Replace optimistic cache with authoritative DB result & clear buffer
      await Promise.all([
        this.cache.set(this.getCacheKey.note(noteId), updated),
        this.cache.del(bufferKey),
        wsId ? this.cache.del(this.getCacheKey.notesList(wsId)) : Promise.resolve(),
      ]);

      this.dbFlushTimers.delete(noteId);
      this.logger.debug(`Flushed note ${noteId} to database`);
    } catch (error) {
      this.logger.error(`Failed to flush note ${noteId} to database`, error);
    }
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
