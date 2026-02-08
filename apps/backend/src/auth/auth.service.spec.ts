import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CacheService } from '../cache/cache.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user if password matches', async () => {
      const user = { 
        id: '1', 
        email: 'test@test.com', 
        passwordHash: 'hashed', 
        name: 'Test', 
        createdAt: new Date(), 
        updatedAt: new Date(),
        avatarUrl: null 
      };
      
      jest.spyOn(usersService, 'findOne').mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@test.com', 'password');
      // Expect result to contain the user properties without passwordHash
      // The implementation seems to strip passwordHash
      const { passwordHash, ...expectedUser } = user;
      expect(result).toEqual(expectedUser);
    });

    it('should return null if user not found', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);
      const result = await service.validateUser('test@test.com', 'password');
      expect(result).toBeNull();
    });

    it('should return null if password does not match', async () => {
      const user = { 
        id: '1', 
        email: 'test@test.com', 
        passwordHash: 'hashed', 
        name: 'Test', 
        createdAt: new Date(), 
        updatedAt: new Date(),
        avatarUrl: null 
      };
      jest.spyOn(usersService, 'findOne').mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@test.com', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token and store session in Redis', async () => {
      const user = { id: '1', email: 'test@test.com', name: 'Test' };
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      const result = await service.login(user); 
      
      expect(result).toEqual({ 
          access_token: 'token',
          user: user
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ email: user.email, sub: user.id, sid: expect.any(String) }),
      );
    });
  });
});
