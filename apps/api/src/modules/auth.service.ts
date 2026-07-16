import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, LoginInput, RegisterInput, User } from '@wisadel/contracts';
import { compare, hash } from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { PersistenceService } from '../shared/persistence.service';

@Injectable()
export class AuthService {
  constructor(private readonly store: PersistenceService, private readonly jwt: JwtService) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    if (await this.store.findUserByEmail(email)) throw new ConflictException('该邮箱已注册');

    const role = this.isAdmin(email) ? 'admin' : 'user';
    const user = await this.store.createUser({ email, nickname: input.nickname.trim(), role, passwordHash: await hash(input.password, 12) });
    return this.issueTokens(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const stored = await this.store.findUserByEmail(input.email.trim().toLowerCase());
    if (!stored || !(await compare(input.password, stored.passwordHash))) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    const user: User = {
      id: stored.id,
      email: stored.email,
      nickname: stored.nickname,
      avatarUrl: stored.avatarUrl,
      role: stored.role,
      createdAt: stored.createdAt
    };
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwt.verify<{ sub: string; type: string }>(refreshToken, { secret: this.refreshSecret });
      if (payload.type !== 'refresh' || !(await this.store.findValidRefreshToken(this.tokenHash(refreshToken)))) throw new Error('invalid');
      const stored = await this.store.findUserById(payload.sub);
      if (!stored) throw new Error('invalid');
      await this.store.revokeRefreshToken(this.tokenHash(refreshToken));
      return this.issueTokens(this.toUser(stored));
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
  }

  async logout(refreshToken: string) {
    await this.store.revokeRefreshToken(this.tokenHash(refreshToken));
    return { revoked: true };
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const refreshToken = this.jwt.sign({ ...payload, type: 'refresh', jti: randomUUID() }, { secret: this.refreshSecret, expiresIn: '30d' });
    await this.store.saveRefreshToken({ userId: user.id, tokenHash: this.tokenHash(refreshToken), expiresAt: new Date(Date.now() + 30 * 86400_000) });
    return {
      user,
      accessToken: this.jwt.sign(payload, { expiresIn: '15m' }),
      refreshToken
    };
  }

  private get refreshSecret() { return process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-before-production'; }
  private tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private toUser(stored: Awaited<ReturnType<PersistenceService['findUserById']>> & {}) : User { return { id: stored.id, email: stored.email, nickname: stored.nickname, avatarUrl: stored.avatarUrl, role: stored.role, createdAt: stored.createdAt }; }

  private isAdmin(email: string) {
    const admins = (process.env.ADMIN_EMAILS ?? 'admin@example.com').split(',').map((item) => item.trim().toLowerCase());
    return admins.includes(email);
  }
}
