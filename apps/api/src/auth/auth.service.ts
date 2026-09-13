import {
  ConflictException,
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import type { RefreshTokenPayload } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

const INVALID_CREDENTIALS = 'Email or password is incorrect';
const INVALID_REFRESH_TOKEN = 'Refresh token is invalid or revoked';

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  private readonly bcryptCost: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow('JWT_REFRESH_SECRET');
    this.accessTtl = Number(config.getOrThrow('JWT_ACCESS_TTL_SECONDS'));
    this.refreshTtl = Number(config.getOrThrow('JWT_REFRESH_TTL_SECONDS'));
    this.bcryptCost = Number(config.getOrThrow('BCRYPT_COST'));
  }

  async register(dto: RegisterDto, userAgent?: string) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new BadRequestException('Password must be at most 72 UTF-8 bytes');
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await hash(dto.password, this.bcryptCost);

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: {
            name: dto.name.trim(),
            email,
            passwordHash,
          },
        });
        const household = await transaction.household.create({
          data: {
            name: dto.householdName.trim(),
            createdBy: createdUser.id,
          },
        });
        await transaction.householdMember.create({
          data: {
            householdId: household.id,
            userId: createdUser.id,
            role: 'OWNER',
          },
        });
        return createdUser;
      });
      return this.createAuthResponse(user.id, userAgent);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, userAgent?: string) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    const user = await this.users.findByEmail(this.normalizeEmail(dto.email));
    const passwordMatches = user?.passwordHash
      ? await compare(dto.password, user.passwordHash)
      : false;
    if (!user || !user.isActive || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.createAuthResponse(user.id, userAgent);
  }

  async refresh(rawToken: string, userAgent?: string) {
    const payload = await this.verifyRefreshToken(rawToken);
    await this.getMe(payload.sub);
    const currentSession = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sid },
    });
    if (
      !currentSession ||
      currentSession.userId !== payload.sub ||
      currentSession.revokedAt ||
      currentSession.expiresAt <= new Date() ||
      !this.hashesMatch(currentSession.tokenHash, this.hashToken(rawToken))
    ) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTtl * 1_000);
    const refreshToken = await this.signRefreshToken(payload.sub, sessionId);
    const revokedAt = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.refreshSession.updateMany({
        where: {
          id: payload.sid,
          revokedAt: null,
          expiresAt: { gt: revokedAt },
        },
        data: { revokedAt },
      });
      if (result.count !== 1) {
        throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
      }
      await transaction.refreshSession.create({
        data: {
          id: sessionId,
          userId: payload.sub,
          tokenHash: this.hashToken(refreshToken),
          userAgent: this.cleanUserAgent(userAgent),
          expiresAt,
        },
      });
    });

    return this.buildAuthResponse(payload.sub, refreshToken);
  }

  async logout(rawToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(rawToken);
    await this.prisma.refreshSession.updateMany({
      where: {
        id: payload.sid,
        userId: payload.sub,
        tokenHash: this.hashToken(rawToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await this.users.findByIdWithMemberships(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is unavailable');
    }
    return this.serializeUser(user);
  }

  private async createAuthResponse(userId: string, userAgent?: string) {
    const sessionId = randomUUID();
    const refreshToken = await this.signRefreshToken(userId, sessionId);
    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: this.cleanUserAgent(userAgent),
        expiresAt: new Date(Date.now() + this.refreshTtl * 1_000),
      },
    });
    return this.buildAuthResponse(userId, refreshToken);
  }

  private async buildAuthResponse(userId: string, refreshToken: string) {
    const user = await this.users.findByIdWithMemberships(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is unavailable');
    }
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, type: 'access' },
      { secret: this.accessSecret, expiresIn: this.accessTtl },
    );
    return {
      ...this.serializeUser(user),
      tokens: {
        accessToken,
        refreshToken,
        accessTokenExpiresIn: this.accessTtl,
      },
    };
  }

  private serializeUser(
    user: Awaited<ReturnType<UsersService['findByIdWithMemberships']>> & {},
  ) {
    return {
      user: { id: user.id, name: user.name, email: user.email },
      households: user.memberships.map((membership) => ({
        id: membership.household.id,
        name: membership.household.name,
        role: membership.role.toLowerCase(),
      })),
    };
  }

  private signRefreshToken(userId: string, sessionId: string) {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: 'refresh' },
      { secret: this.refreshSecret, expiresIn: this.refreshTtl },
    );
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
        algorithms: ['HS256'],
      });
      if (
        payload.type !== 'refresh' ||
        !isUUID(payload.sub) ||
        !isUUID(payload.sid)
      ) {
        throw new Error('Wrong token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private cleanUserAgent(userAgent?: string): string | undefined {
    return userAgent?.slice(0, 255);
  }
}
