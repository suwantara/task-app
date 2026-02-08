import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { PermissionsService } from '../common/permissions.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly permissions: PermissionsService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(userId: string, createColumnDto: CreateColumnDto) {
    await this.permissions.validateBoardAccess(userId, createColumnDto.boardId);

    const position = createColumnDto.order ?? await this.getNextPosition(createColumnDto.boardId);

    return this.prisma.column.create({
      data: {
        name: createColumnDto.name,
        boardId: createColumnDto.boardId,
        position,
        color: createColumnDto.color ?? null,
      },
      include: { tasks: true },
    });
  }

  async findAll(userId: string, boardId: string) {
    await this.permissions.validateBoardAccess(userId, boardId);

    return this.prisma.column.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
      include: { tasks: true },
    });
  }

  async findOne(id: string, userId: string) {
    const column = await this.prisma.column.findUnique({
      where: { id },
      include: { tasks: true },
    });

    if (!column) throw new NotFoundException('Column not found');

    await this.permissions.validateBoardAccess(userId, column.boardId);

    return column;
  }

  async update(id: string, userId: string, updateColumnDto: UpdateColumnDto) {
    const column = await this.prisma.column.findUnique({
      where: { id },
      select: { id: true, boardId: true },
    });

    if (!column) throw new NotFoundException('Column not found');

    await this.permissions.validateBoardAccess(userId, column.boardId);

    const updatedColumnOptimistic = {
      ...column,
      ...updateColumnDto,
      updatedAt: new Date(),
    };

    this.realtime.emitColumnUpdated(column.boardId, updatedColumnOptimistic);

    const updated = await this.prisma.column.update({
      where: { id },
      data: updateColumnDto,
    });

    await this.cache.del(`board:${column.boardId}`);

    return updated;
  }

  async remove(id: string, userId: string) {
    const column = await this.prisma.column.findUnique({
      where: { id },
      select: { id: true, boardId: true },
    });

    if (!column) throw new NotFoundException('Column not found');

    await this.permissions.validateBoardAccess(userId, column.boardId);

    return this.prisma.column.delete({ where: { id } });
  }

  /** Calculate next position for a new column in a board. */
  private async getNextPosition(boardId: string): Promise<number> {
    const lastColumn = await this.prisma.column.findFirst({
      where: { boardId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return lastColumn ? lastColumn.position + 1 : 0;
  }
}
