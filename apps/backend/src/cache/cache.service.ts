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
  private subClient: Redis | null = null;
  private readonly prefix = 'task-app:';
  private readonly defaultTTL = 300; // 5 minutes in seconds
  private readonly messageHandlers = new Map<
    string,
    ((channel: string, data: unknown) => void)[]
  >();

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
      return;
    }

    // Create subscriber client for pub/sub
    try {
      this.subClient = this.client.duplicate();
      await this.subClient.connect();

      this.subClient.on(
        'pmessage',
        (_pattern: string, channel: string, message: string) => {
          const cleanChannel = channel.startsWith(this.prefix)
            ? channel.slice(this.prefix.length)
            : channel;
          // Find handlers for the matching pattern
          for (const [pattern, handlers] of this.messageHandlers.entries()) {
            if (this.globToRegex(pattern).exec(channel)) {
              for (const handler of handlers) {
                try {
                  handler(cleanChannel, JSON.parse(message));
                } catch {
                  this.logger.warn(
                    `PubSub handler error for channel ${channel}`,
                  );
                }
              }
            }
          }
        },
      );
      this.logger.log('Redis subscriber client connected');
    } catch (error: unknown) {
      const subMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('Redis subscriber failed:', subMsg);
      this.subClient = null;
    }
  }

  async onModuleDestroy() {
    if (this.subClient) {
      await this.subClient.quit();
    }
    if (this.client) {
      await this.client.quit();
    }
  }

  private globToRegex(pattern: string): RegExp {
    const escaped = pattern.replaceAll(/[.+^${}()|[\]\\]/g, '\\$&');
    return new RegExp('^' + escaped.replaceAll('*', '.*') + '$');
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  /**
   * Ping Redis to check connectivity
   */
  async ping(): Promise<string> {
    if (!this.isConnected()) throw new Error('Redis not connected');
    return this.client.ping();
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
   * Delete all keys matching a pattern using SCAN (production-safe)
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.isConnected()) return;

    try {
      const prefixedPattern = this.getKey(pattern);
      let cursor = '0';
      let totalDeleted = 0;
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          prefixedPattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');
      if (totalDeleted > 0) {
        this.logger.debug(
          `Cache DEL pattern: ${pattern} (${totalDeleted} keys)`,
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

  // ─── Redis Pub/Sub ──────────────────────────────────────────

  /**
   * Publish a message to a Redis channel
   */
  async publish(channel: string, data: unknown): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.client.publish(this.getKey(channel), JSON.stringify(data));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Publish error for ${channel}:`, message);
    }
  }

  /**
   * Subscribe to channels matching a glob pattern.
   * Handler receives the clean channel name (without prefix).
   */
  async psubscribe(
    pattern: string,
    handler: (channel: string, data: unknown) => void,
  ): Promise<void> {
    if (!this.subClient?.status || this.subClient.status !== 'ready') {
      this.logger.warn('Cannot subscribe: subscriber client not ready');
      return;
    }

    const prefixedPattern = this.getKey(pattern);

    if (!this.messageHandlers.has(prefixedPattern)) {
      this.messageHandlers.set(prefixedPattern, []);
      await this.subClient.psubscribe(prefixedPattern);
      this.logger.log(`Subscribed to pattern: ${pattern}`);
    }
    this.messageHandlers.get(prefixedPattern)!.push(handler);
  }

  // ─── Redis Hash (presence) ──────────────────────────────────

  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.client.hset(this.getKey(key), field, value);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`HSET error for ${key}:`, msg);
    }
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.client.hdel(this.getKey(key), ...fields);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`HDEL error for ${key}:`, msg);
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.isConnected()) return {};
    try {
      return await this.client.hgetall(this.getKey(key));
    } catch {
      return {};
    }
  }

  // ─── Redis Set (socket room tracking) ───────────────────────

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.client.sadd(this.getKey(key), ...members);
    } catch {}
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.client.srem(this.getKey(key), ...members);
    } catch {}
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.isConnected()) return [];
    try {
      return await this.client.smembers(this.getKey(key));
    } catch {
      return [];
    }
  }

  // ─── Redis Buffer (Yjs binary state) ────────────────────────

  async setBuffer(
    key: string,
    value: Buffer,
    ttl: number = 86400,
  ): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.client.setex(this.getKey(key), ttl, value);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`SetBuffer error for ${key}:`, msg);
    }
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    if (!this.isConnected()) return null;
    try {
      return await this.client.getBuffer(this.getKey(key));
    } catch {
      return null;
    }
  }
}
