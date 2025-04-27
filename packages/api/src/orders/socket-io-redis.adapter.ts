import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions, Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { INestApplication, Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private pubClient: Redis;
  private subClient: Redis;

  constructor(
    private app: INestApplication,
    private configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    try {
      this.logger.log('Connecting to Redis for Socket.IO adapter...');
      
      const host = this.configService.get('REDIS_HOST', 'localhost');
      const port = parseInt(this.configService.get('REDIS_PORT', '6379'));
      const password = this.configService.get('REDIS_PASSWORD', '');
      const db = parseInt(this.configService.get('REDIS_DB', '0'));
      
      const redisConfig = {
        host,
        port,
        password: password ? password : undefined,
        db,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          this.logger.log(`Redis reconnection attempt ${times} in ${delay}ms`);
          return delay;
        },
      };
      
      this.pubClient = new Redis(redisConfig);
      this.subClient = this.pubClient.duplicate();
      
      this.pubClient.on('connect', () => {
        this.logger.log('Redis Pub client connected successfully');
      });
      
      this.subClient.on('connect', () => {
        this.logger.log('Redis Sub client connected successfully');
      });
      
      this.pubClient.on('error', (err) => {
        this.logger.error(`Redis Pub client error: ${err.message}`, err.stack);
      });
      
      this.subClient.on('error', (err) => {
        this.logger.error(`Redis Sub client error: ${err.message}`, err.stack);
      });
      
      this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
      
      this.logger.log('Redis adapter for Socket.IO created successfully');
    } catch (error) {
      this.logger.error(`Failed to connect to Redis: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options);
    
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.logger.log('Socket.IO server is now using Redis adapter');
    } else {
      this.logger.warn('Socket.IO server initialized without Redis adapter');
    }
    
    return server;
  }
  
  async close() {
    try {
      this.logger.log('Closing Redis connections...');
      
      if (this.pubClient) {
        await this.pubClient.quit();
        this.logger.log('Redis Pub client closed');
      }
      
      if (this.subClient) {
        await this.subClient.quit();
        this.logger.log('Redis Sub client closed');
      }
    } catch (error) {
      this.logger.error(`Error closing Redis connections: ${error.message}`, error.stack);
    }
  }
} 