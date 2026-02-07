import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a user by email', async () => {
      const result = {
        id: '1',
        email: 'test@test.com',
        name: 'Test',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        avatarUrl: null,
      };
      const email = 'test@test.com';

      const findUniqueSpy = jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue(result);

      expect(await service.findOne(email)).toBe(result);
      expect(findUniqueSpy).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
    });
  });
});
