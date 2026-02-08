import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeGateway } from './realtime.gateway';
import { CacheService } from '../cache/cache.service';
import { JwtService } from '@nestjs/jwt';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
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
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue({ sub: 'user-1', email: 'test@test.com', sid: 'session-1' }),
            sign: jest.fn().mockReturnValue('mock-token'),
          },
        },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
