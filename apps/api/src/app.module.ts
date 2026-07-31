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
import { BillingController } from './modules/billing.controller';
import { BillingService } from './modules/billing.service';
import { AgentTaskController } from './modules/agent-task.controller';
import { AgentTaskService } from './modules/agent-task.service';
import { ProviderRouterService } from './providers/provider-router.service';
import { BrowserAutomationService } from './providers/browser-automation.service';
import { WorkspaceController } from './modules/workspace.controller';
import { WorkspaceService } from './modules/workspace.service';
import { ProjectContextController } from './modules/project-context.controller';
import { ProjectContextService } from './modules/project-context.service';
import { LocalAgentActionController } from './modules/local-agent-action.controller';
import { LocalAgentActionService } from './modules/local-agent-action.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-only-secret-change-before-production',
      signOptions: { expiresIn: '15m' }
    })
  ],
  controllers: [AuthController, ChatController, ImageController, UploadController, HealthController, AdminController, BillingController, AgentTaskController, WorkspaceController, ProjectContextController, LocalAgentActionController],
  providers: [MemoryStore, PrismaService, PersistenceService, ImageStorageService, StableDiffusionService, QueueService, BrowserAutomationService, AgentToolsService, DeepSeekService, ProviderRouterService, QwenService, AuthService, ChatService, ImageService, BillingService, AgentTaskService, WorkspaceService, ProjectContextService, LocalAgentActionService]
})
export class AppModule {}
