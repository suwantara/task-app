import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis;
  private readonly prefix = 'task-app:';
  private readonly defaultTTL = 300; // 5 minutes in seconds

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('error', (err: Error) => {
      this.logger.error('Redis connection error:', err.message);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    try {
      await this.client.connect();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('Redis connection failed, caching disabled:', message);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  /**
   * Get a cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected()) return null;

    try {
      const data = await this.client.get(this.getKey(key));
      if (data) {
        this.logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(data) as T;
      }
      this.logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Cache get error for ${key}:`, message);
      return null;
    }
  }

  /**
   * Set a cached value with optional TTL
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.isConnected()) return;

    try {
      const serialized = JSON.stringify(value);
      const effectiveTTL = ttl ?? this.defaultTTL;

      await this.client.setex(this.getKey(key), effectiveTTL, serialized);
      this.logger.debug(`Cache SET: ${key} (TTL: ${effectiveTTL}s)`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Cache set error for ${key}:`, message);
    }
  }

  /**
   * Delete a cached value by key
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected()) return;

    try {
      await this.client.del(this.getKey(key));
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Cache del error for ${key}:`, message);
    }
  }

  /**
   * Delete all keys matching a pattern (e.g., "workspaces:user:*")
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.isConnected()) return;

    try {
      const keys = await this.client.keys(this.getKey(pattern));
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.debug(
          `Cache DEL pattern: ${pattern} (${keys.length} keys)`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Cache delPattern error for ${pattern}:`, message);
    }
  }

  /**
   * Get or set: returns cached value or executes factory and caches result
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }
}
