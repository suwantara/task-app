import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(userId: string, createColumnDto: CreateColumnDto) {
    // Verify board access
    const board = await this.prisma.board.findUnique({
      where: { id: createColumnDto.boardId },
      include: { workspace: { include: { members: true } } },
    });

    if (!board) throw new NotFoundException('Board not found');

    const isMember = board.workspace.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Access denied');

    // Calculate position if not provided
    let position = createColumnDto.order;
    if (position === undefined) {
      const lastColumn = await this.prisma.column.findFirst({
        where: { boardId: createColumnDto.boardId },
        orderBy: { position: 'desc' },
      });
      position = lastColumn ? lastColumn.position + 1 : 0;
    }

    return this.prisma.column.create({
      data: {
        name: createColumnDto.name,
        boardId: createColumnDto.boardId,
        position: position,
      },
      include: { tasks: true },
    });
  }

  async findAll(userId: string, boardId: string) {
    // Verify access
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: { workspace: { include: { members: true } } },
    });

    if (!board) throw new NotFoundException('Board not found');

    const isMember = board.workspace.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Access denied');

    return this.prisma.column.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
      include: { tasks: true },
    });
  }

  async findOne(id: string, userId: string) {
    const column = await this.prisma.column.findUnique({
      where: { id },
      include: {
        board: {
          include: {
            workspace: { include: { members: true } },
          },
        },
        tasks: true,
      },
    });

    if (!column) throw new NotFoundException('Column not found');

    const isMember = column.board.workspace.members.some(
      (m) => m.userId === userId,
    );
    if (!isMember) throw new ForbiddenException('Access denied');

    return column;
  }

  async update(id: string, userId: string, updateColumnDto: UpdateColumnDto) {
    const column = await this.prisma.column.findUnique({
      where: { id },
      include: {
        board: {
          include: { workspace: { include: { members: true } } },
        },
      },
    });

    if (!column) throw new NotFoundException('Column not found');

    const isMember = column.board.workspace.members.some(
      (m) => m.userId === userId,
    );
    if (!isMember) throw new ForbiddenException('Access denied');

    const boardId = column.boardId;

    // Optimistic Update (For broadcast)
    const updatedColumnOptimistic = {
      ...column,
      ...updateColumnDto,
      updatedAt: new Date(), // Ensure we send a valid date object or string depending on what frontend expects, Date is fine for socket.io usually
    };

    // Broadcast immediately
    this.realtime.emitColumnUpdated(boardId, updatedColumnOptimistic);

    // Persist to Database
    const updated = await this.prisma.column.update({
      where: { id },
      data: updateColumnDto,
    });

    // Invalidate Board Cache
    await this.cache.del(`board:${boardId}`);

    return updated;
  }

  async remove(id: string, userId: string) {
    const column = await this.prisma.column.findUnique({
      where: { id },
      include: {
        board: {
          include: { workspace: { include: { members: true } } },
        },
      },
    });

    if (!column) throw new NotFoundException('Column not found');

    const isMember = column.board.workspace.members.some(
      (m) => m.userId === userId,
    );
    if (!isMember) throw new ForbiddenException('Access denied');

    return this.prisma.column.delete({
      where: { id },
    });
  }
}
