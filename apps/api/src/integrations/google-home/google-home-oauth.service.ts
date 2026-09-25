import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  DEFAULT_GOOGLE_CLIENT_ID,
  DEFAULT_GOOGLE_CLIENT_SECRET,
} from './google-home.constants.js';

interface GoogleAuthTokenPayload {
  sub: string;
  type: 'google_auth_code' | 'google_access_token' | 'google_refresh_token';
}

@Injectable()
export class GoogleHomeOauthService {
  private readonly jwtSecret: string;
  private readonly expectedClientId: string;
  private readonly expectedClientSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.jwtSecret =
      config.get<string>('JWT_ACCESS_SECRET') ??
      'smart-home-production-access-key-at-least-32-chars';
    this.expectedClientId =
      config.get<string>('GOOGLE_HOME_CLIENT_ID') ?? DEFAULT_GOOGLE_CLIENT_ID;
    this.expectedClientSecret =
      config.get<string>('GOOGLE_HOME_CLIENT_SECRET') ??
      DEFAULT_GOOGLE_CLIENT_SECRET;
  }

  validateClient(clientId?: string, clientSecret?: string): boolean {
    if (!clientId || clientId !== this.expectedClientId) {
      return false;
    }
    if (clientSecret !== undefined && clientSecret !== this.expectedClientSecret) {
      return false;
    }
    return true;
  }

  async authenticateUser(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user || !user.isActive || !user.passwordHash) {
      return null;
    }
    const matches = await compare(password, user.passwordHash);
    if (!matches) {
      return null;
    }
    return user;
  }

  async generateAuthCode(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, type: 'google_auth_code' },
      { secret: this.jwtSecret, expiresIn: '10m' },
    );
  }

  async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret?: string,
  ) {
    if (!this.validateClient(clientId, clientSecret)) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    try {
      const payload = await this.jwt.verifyAsync<GoogleAuthTokenPayload>(code, {
        secret: this.jwtSecret,
      });

      if (payload.type !== 'google_auth_code' || !isUUID(payload.sub)) {
        throw new BadRequestException('Invalid authorization code');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User is not active');
      }

      const accessToken = await this.jwt.signAsync(
        { sub: user.id, type: 'google_access_token' },
        { secret: this.jwtSecret, expiresIn: '30d' },
      );

      const refreshToken = await this.jwt.signAsync(
        { sub: user.id, type: 'google_refresh_token' },
        { secret: this.jwtSecret, expiresIn: '365d' },
      );

      return {
        token_type: 'bearer',
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 30 * 24 * 3600,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Authorization code has expired or is invalid');
    }
  }

  async refreshTokens(
    refreshToken: string,
    clientId: string,
    clientSecret?: string,
  ) {
    if (!this.validateClient(clientId, clientSecret)) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    try {
      const payload = await this.jwt.verifyAsync<GoogleAuthTokenPayload>(
        refreshToken,
        { secret: this.jwtSecret },
      );

      if (payload.type !== 'google_refresh_token' || !isUUID(payload.sub)) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User is not active');
      }

      const accessToken = await this.jwt.signAsync(
        { sub: user.id, type: 'google_access_token' },
        { secret: this.jwtSecret, expiresIn: '30d' },
      );

      return {
        token_type: 'bearer',
        access_token: accessToken,
        expires_in: 30 * 24 * 3600,
      };
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  async verifyAccessToken(token: string): Promise<{ userId: string }> {
    try {
      const payload = await this.jwt.verifyAsync<GoogleAuthTokenPayload>(token, {
        secret: this.jwtSecret,
      });

      if (payload.type !== 'google_access_token' || !isUUID(payload.sub)) {
        throw new UnauthorizedException('Invalid access token');
      }

      return { userId: payload.sub };
    } catch {
      throw new UnauthorizedException('Google Home access token invalid or expired');
    }
  }
}
