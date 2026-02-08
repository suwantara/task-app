import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './cache/cache.service';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async healthCheck() {
    const checks = {
      status: 'unknown' as string,
      timestamp: new Date().toISOString(),
      redis: false,
      database: false,
    };

    // Check Redis
    try {
      const pong = await this.cache.ping();
      checks.redis = pong === 'PONG';
    } catch {
      checks.redis = false;
    }

    // Check Database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    checks.status = checks.redis && checks.database ? 'healthy' : 'degraded';
    return checks;
  }
}
