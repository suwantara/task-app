import { Test, TestingModule } from '@nestjs/testing';
import { NotesService } from './notes.service';

import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PermissionsService } from '../common/permissions.service';

describe('NotesService', () => {
  let service: NotesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: PrismaService,
          useValue: {
            note: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            workspaceMember: {
              findUnique: jest.fn(),
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
        {
          provide: PermissionsService,
          useValue: {
            validateWorkspaceAccess: jest.fn().mockResolvedValue({ workspaceId: 'ws-1' }),
            validateNoteAccess: jest.fn().mockResolvedValue({ workspaceId: 'ws-1' }),
          },
        },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
