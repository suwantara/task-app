import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { CacheService } from '../cache/cache.service';
import { RealtimeService } from '../realtime/realtime.service';
import { MemberRole, TaskPriority } from '@prisma/client';

describe('TasksService', () => {
  let service: TasksService;
  let prismaService: PrismaService;
  let permissionsService: PermissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: PrismaService,
          useValue: {
            task: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
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
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    prismaService = module.get<PrismaService>(PrismaService);
    permissionsService = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a task', async () => {
      const userId = 'user-1';
      const dto = {
        title: 'New Task',
        columnId: 'col-1',
        description: 'Desc',
        priority: TaskPriority.MEDIUM,
      };
      const accessInfo = {
        id: 'member-1',
        userId,
        workspaceId: 'ws-1',
        role: MemberRole.MEMBER,
        joinedAt: new Date(),
      };
      // Correcting the mock response structure to match the new permissions service API
      const mockAccessInfo = { member: accessInfo, boardId: 'board-1' };

      const createdTask = {
        id: 'task-1',
        ...dto,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: 0,
      };

      const mockAccessInfoCasted = mockAccessInfo as unknown as {
        member: {
          id: string;
          workspaceId: string;
          userId: string;
          role: MemberRole;
          joinedAt: Date;
        };
        boardId: string;
      };

      const validateColumnAccessSpy = jest
        .spyOn(permissionsService, 'validateColumnAccess')
        .mockResolvedValue(mockAccessInfoCasted);
      jest
        .spyOn(prismaService.task, 'create')
        .mockResolvedValue(createdTask as any);

      const result = await service.create(userId, dto);

      expect(result).toEqual(createdTask);
      expect(validateColumnAccessSpy).toHaveBeenCalledWith(
        userId,
        dto.columnId,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of tasks', async () => {
      const userId = 'user-1';
      const boardId = 'board-1';
      const tasks = [{ id: 'task-1', title: 'Task 1' }];

      jest
        .spyOn(permissionsService, 'validateBoardAccess')
        .mockResolvedValue({} as any);
      jest
        .spyOn(prismaService.task, 'findMany')
        .mockResolvedValue(tasks as any);

      const result = await service.findAll(userId, boardId);

      expect(result).toEqual(tasks);
    });
  });
});
