import { Controller, Get } from '@nestjs/common';
import type { Health } from '@wisadel/contracts';

@Controller('health')
export class HealthController {
  @Get()
  health(): Health {
    const mock = (process.env.AI_MODE ?? 'mock') === 'mock';
    const memory = (process.env.DATA_MODE ?? 'memory') === 'memory';
    const redis = (process.env.QUEUE_MODE ?? 'memory') === 'redis';
    return {
      status: 'ok',
      version: '0.1.0',
      mode: mock ? 'mock' : 'integrated',
      services: {
        api: 'up',
        database: memory ? 'mock' : 'up',
        redis: redis ? 'up' : 'mock',
        deepseek: mock ? 'mock' : process.env.DEEPSEEK_API_KEY ? 'configured' : 'unavailable',
        qwen: mock ? 'mock' : process.env.QWEN_API_KEY ? 'configured' : 'unavailable',
        stableDiffusion: (process.env.SD_MODE ?? 'mock') === 'remote' && process.env.SD_BASE_URL ? 'configured' : 'unavailable'
      }
    };
  }
}
