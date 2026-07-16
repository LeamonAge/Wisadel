import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './modules/admin.controller';
import { AuthController } from './modules/auth.controller';
import { AuthService } from './modules/auth.service';
import { ChatController } from './modules/chat.controller';
import { ChatService } from './modules/chat.service';
import { HealthController } from './modules/health.controller';
import { ImageController } from './modules/image.controller';
import { ImageService } from './modules/image.service';
import { MemoryStore } from './shared/memory.store';
import { PrismaService } from './shared/prisma.service';
import { PersistenceService } from './shared/persistence.service';
import { QueueService } from './shared/queue.service';
import { DeepSeekService } from './providers/deepseek.service';
import { QwenService } from './providers/qwen.service';
import { StableDiffusionService } from './providers/stable-diffusion.service';
import { UploadController } from './modules/upload.controller';
import { ImageStorageService } from './shared/image-storage.service';
import { AgentToolsService } from './providers/agent-tools.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-only-secret-change-before-production',
      signOptions: { expiresIn: '15m' }
    })
  ],
  controllers: [AuthController, ChatController, ImageController, UploadController, HealthController, AdminController],
  providers: [MemoryStore, PrismaService, PersistenceService, ImageStorageService, StableDiffusionService, QueueService, AgentToolsService, DeepSeekService, QwenService, AuthService, ChatService, ImageService]
})
export class AppModule {}
