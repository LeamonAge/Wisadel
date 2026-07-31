import { Body, Controller, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { loginInputSchema, registerInputSchema, type LoginInput, type RegisterInput } from '@wisadel/contracts';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../shared/zod-validation.pipe';
import { AuthGuard, currentUser } from '../shared/auth.guard';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(registerInputSchema)) input: RegisterInput) {
    return this.auth.register(input);
  }

  @Post('login')
  login(@Body(new ZodValidationPipe(loginInputSchema)) input: LoginInput) {
    return this.auth.login(input);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.auth.refresh(refreshToken);
  }

  @Post('logout')
  logout(@Body('refreshToken') refreshToken: string) {
    return this.auth.logout(refreshToken);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  profile(@Req() request: Request, @Body() body: { nickname?: string; avatarUrl?: string | null }) {
    const nickname = String(body.nickname ?? '').trim().slice(0, 50);
    const avatarUrl = body.avatarUrl === null ? null : String(body.avatarUrl ?? '').trim().slice(0, 1000) || null;
    if (!nickname) throw new Error('Nickname is required');
    if (avatarUrl && !/^https?:\/\//i.test(avatarUrl) && !avatarUrl.startsWith('data:image/')) throw new Error('Invalid avatar URL');
    return this.auth.updateProfile(currentUser(request).sub, { nickname, avatarUrl });
  }
}
