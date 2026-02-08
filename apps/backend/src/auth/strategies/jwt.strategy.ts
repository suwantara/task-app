import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';

interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'super-secret-key-change-this',
    });
  }

  async validate(payload: JwtPayload): Promise<{ userId: string; email: string }> {
    // Reject tokens without session ID (legacy tokens before session enforcement)
    if (!payload.sid) {
      throw new UnauthorizedException('Invalid token — please log in again');
    }

    // Validate single-session: sid in JWT must match active session in Redis
    const activeSession = await this.cacheService.get<string>(`session:${payload.sub}`);
    // If Redis is down (null), allow access (graceful degradation)
    if (activeSession !== null && activeSession !== payload.sid) {
      throw new UnauthorizedException('Session expired — logged in from another device');
    }

    return { userId: payload.sub, email: payload.email };
  }
}
