import { Test, TestingModule } from '@nestjs/testing';
import { BoardsService } from './boards.service';

import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { PermissionsService } from '../common/permissions.service';

describe('BoardsService', () => {
  let service: BoardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        {
          provide: PrismaService,
          useValue: {
            board: {
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
            validateWorkspaceAccess: jest.fn().mockResolvedValue({ workspaceId: 'ws-1' }),
            validateBoardAccess: jest.fn().mockResolvedValue({ workspaceId: 'ws-1', boardId: 'board-1' }),
          },
        },
      ],
    }).compile();

    service = module.get<BoardsService>(BoardsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
