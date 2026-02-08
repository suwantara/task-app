import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CacheService } from '../cache/cache.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RegisterInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

@Injectable()
export class AuthService {
  /** 7 days in seconds — matches JWT expiresIn */
  private readonly SESSION_TTL = 7 * 24 * 60 * 60;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly cacheService: CacheService,
  ) {}

  async validateUser(email: string, pass: string): Promise<SafeUser | null> {
    const user = await this.usersService.findOne(email);
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: SafeUser): Promise<{ access_token: string; user: SafeUser }> {
    const sessionId = randomUUID();

    // Read old session BEFORE overwriting — only notify if a previous session existed
    const previousSession = await this.cacheService.get<string>(`session:${user.id}`);

    // Store the new active session in Redis
    await this.cacheService.set(`session:${user.id}`, sessionId, this.SESSION_TTL);

    // Notify old sessions to force-logout AFTER new session is stored
    // Only publish if there was a previous session (avoids unnecessary pub/sub)
    if (previousSession) {
      await this.cacheService.publish('session:force-logout', {
        userId: user.id,
        oldSessionId: previousSession,
      });
    }

    const payload = { email: user.email, sub: user.id, sid: sessionId };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async registerAndLogin(data: RegisterInput): Promise<{ access_token: string; user: SafeUser }> {
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(data.password, salt);
    const { password, ...userData } = data;
    const created = await this.usersService.create({
      ...userData,
      passwordHash,
    });
    const { passwordHash: _, ...safeUser } = created;
    return this.login(safeUser);
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Server-side logout: delete the active session from Redis.
   * Any subsequent API call with the old JWT will fail session validation.
   */
  async logout(userId: string): Promise<void> {
    await this.cacheService.del(`session:${userId}`);
  }

  /**
   * Validate that a session ID matches the active session in Redis.
   * Returns true if valid, false if invalidated (another device logged in).
   */
  async isSessionValid(userId: string, sessionId: string): Promise<boolean> {
    const activeSession = await this.cacheService.get<string>(`session:${userId}`);
    // If Redis is down (null), allow access (graceful degradation)
    if (activeSession === null) return true;
    return activeSession === sessionId;
  }
}
