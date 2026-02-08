import { Test, TestingModule } from '@nestjs/testing';
import { ColumnsService } from './columns.service';

import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { PermissionsService } from '../common/permissions.service';
import { RealtimeService } from '../realtime/realtime.service';

describe('ColumnsService', () => {
  let service: ColumnsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColumnsService,
        {
          provide: PrismaService,
          useValue: {
            column: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
            delPattern: jest.fn().mockResolvedValue(undefined),
            getOrSet: jest.fn().mockImplementation((_k: string, fn: () => Promise<unknown>) => fn()),
            publish: jest.fn().mockResolvedValue(undefined),
            psubscribe: jest.fn().mockResolvedValue(undefined),
            hset: jest.fn().mockResolvedValue(undefined),
            hdel: jest.fn().mockResolvedValue(undefined),
            hgetall: jest.fn().mockResolvedValue({}),
            sadd: jest.fn().mockResolvedValue(undefined),
            srem: jest.fn().mockResolvedValue(undefined),
            smembers: jest.fn().mockResolvedValue([]),
            setBuffer: jest.fn().mockResolvedValue(undefined),
            getBuffer: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: PermissionsService,
          useValue: {
            validateColumnAccess: jest.fn(),
            validateBoardAccess: jest.fn(),
            validateTaskAccess: jest.fn(),
          },
        },
        {
          provide: RealtimeService,
          useValue: {
            emitTaskCreated: jest.fn(),
            emitTaskUpdated: jest.fn(),
            emitTaskDeleted: jest.fn(),
            emitColumnCreated: jest.fn(),
            emitColumnUpdated: jest.fn(),
            emitNoteCreated: jest.fn(),
            emitNoteUpdated: jest.fn(),
            emitNoteDeleted: jest.fn(),
            emitPresenceUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ColumnsService>(ColumnsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
