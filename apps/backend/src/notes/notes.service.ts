import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class NotesService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

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

    return this.prisma.note.create({
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

    return this.prisma.note.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
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

    return this.prisma.note.update({
      where: { id },
      data: updateNoteDto,
    }).then((updated) => {
      this.realtime.emitNoteUpdated(note.workspaceId, updated);
      return updated;
    });
  }

  async remove(id: string, userId: string) {
    const note = await this.prisma.note.findUnique({
      where: { id },
      include: { workspace: { include: { members: true } } },
    });

    if (!note) throw new NotFoundException('Note not found');

    // Only creator or workspace owner can delete? For MVP, let's say any member can delete (like Notion teamspace)
    const isMember = note.workspace.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Access denied');

    return this.prisma.note.delete({
      where: { id },
    });
  }
}
