import { Body, Controller, Post } from '@nestjs/common';
import { loginInputSchema, registerInputSchema, type LoginInput, type RegisterInput } from '@wisadel/contracts';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../shared/zod-validation.pipe';

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
}
