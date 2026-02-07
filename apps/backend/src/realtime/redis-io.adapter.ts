import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { INestApplication } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(app: INestApplication) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380';
    console.log(`[RedisIoAdapter] Connecting to Redis: ${redisUrl}`);

    const pubClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[RedisIoAdapter] Redis connection failed after 3 retries, falling back to in-memory adapter');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    try {
      await pubClient.connect();
      const subClient = pubClient.duplicate();
      await subClient.connect();
      this.adapterConstructor = createAdapter(pubClient, subClient);
      console.log('[RedisIoAdapter] Redis adapter connected successfully');
    } catch (error) {
      console.warn('[RedisIoAdapter] Failed to connect to Redis, using in-memory adapter:', error);
      this.adapterConstructor = null;
    }
  }

  createIOServer(port: number, options?: Partial<ServerOptions>): unknown {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: true,
        credentials: true,
      },
    });

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
