import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { GoogleHomeOauthService } from './google-home-oauth.service.js';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Injectable()
export class GoogleHomeAuthGuard implements CanActivate {
  constructor(private readonly oauthService: GoogleHomeOauthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7).trim();
    const { userId } = await this.oauthService.verifyAccessToken(token);
    request.user = { id: userId };
    return true;
  }
}
