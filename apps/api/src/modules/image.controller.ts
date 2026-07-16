import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { createImageTaskInputSchema, type CreateImageTaskInput } from '@wisadel/contracts';
import type { Request } from 'express';
import { AuthGuard, currentUser } from '../shared/auth.guard';
import { ZodValidationPipe } from '../shared/zod-validation.pipe';
import { ImageService } from './image.service';
import { StableDiffusionService } from '../providers/stable-diffusion.service';

@Controller('image-tasks')
@UseGuards(AuthGuard)
export class ImageController {
  constructor(private readonly images: ImageService, private readonly sd: StableDiffusionService) {}

  @Get('capabilities')
  capabilities() { return this.sd.capabilities(); }

  @Post()
  create(@Req() request: Request, @Body(new ZodValidationPipe(createImageTaskInputSchema)) input: CreateImageTaskInput) {
    return this.images.create(currentUser(request).sub, input);
  }

  @Get()
  list(@Req() request: Request, @Query('sessionId') sessionId?: string) {
    return this.images.list(currentUser(request).sub, sessionId);
  }

  @Get(':id')
  get(@Req() request: Request, @Param('id') id: string) {
    return this.images.get(currentUser(request).sub, id);
  }

  @Post(':id/cancel')
  cancel(@Req() request: Request, @Param('id') id: string) {
    return this.images.cancel(currentUser(request).sub, id);
  }

  @Post(':id/retry')
  retry(@Req() request: Request, @Param('id') id: string) {
    return this.images.retry(currentUser(request).sub, id);
  }
}
