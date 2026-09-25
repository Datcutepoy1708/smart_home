import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { GoogleHomeOauthService } from './google-home-oauth.service.js';

interface AuthorizeQueryParams {
  client_id?: string;
  redirect_uri?: string;
  state?: string;
  response_type?: string;
}

interface AuthorizeBody {
  email?: string;
  password?: string;
  client_id?: string;
  redirect_uri?: string;
  state?: string;
}

interface TokenBody {
  grant_type?: string;
  code?: string;
  refresh_token?: string;
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
}

function renderHtmlLogin({
  clientId = '',
  redirectUri = '',
  state = '',
  errorMessage = '',
  prefilledEmail = '',
}: {
  clientId?: string;
  redirectUri?: string;
  state?: string;
  errorMessage?: string;
  prefilledEmail?: string;
}) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Liên kết Google Home - Smart Home</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      background: radial-gradient(circle at 50% 10%, #1e1b4b 0%, #09090b 100%);
      color: #f4f4f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: rgba(24, 24, 27, 0.85);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 32px 24px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .brand {
      text-align: center;
      margin-bottom: 24px;
    }
    .brand-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #4f46e5, #06b6d4);
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      box-shadow: 0 8px 24px rgba(79, 70, 229, 0.4);
      margin-bottom: 12px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 13px;
      color: #a1a1aa;
      line-height: 1.5;
    }
    .error-banner {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 18px;
      text-align: center;
    }
    .form-group {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #d4d4d8;
      margin-bottom: 6px;
    }
    input[type="text"], input[type="email"], input[type="password"] {
      width: 100%;
      background: rgba(39, 39, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      padding: 12px 14px;
      color: #ffffff;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }
    .btn-submit {
      width: 100%;
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 14px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.35);
      transition: transform 0.1s, opacity 0.2s;
      margin-top: 8px;
    }
    .btn-submit:active {
      transform: scale(0.98);
      opacity: 0.9;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="brand-icon">🏠</div>
      <h1 class="title">Smart Home IoT</h1>
      <p class="subtitle">Ủy quyền cho <strong>Google Assistant & Google Home</strong> điều khiển thiết bị thông minh của bạn.</p>
    </div>

    ${errorMessage ? `<div class="error-banner">${errorMessage}</div>` : ''}

    <form method="POST" action="/api/v1/integrations/google-home/oauth/authorize">
      <input type="hidden" name="client_id" value="${clientId}">
      <input type="hidden" name="redirect_uri" value="${redirectUri}">
      <input type="hidden" name="state" value="${state}">

      <div class="form-group">
        <label for="email">Tài khoản Email</label>
        <input type="email" id="email" name="email" value="${prefilledEmail}" placeholder="admin@home.local" required autocomplete="username">
      </div>

      <div class="form-group">
        <label for="password">Mật khẩu</label>
        <input type="password" id="password" name="password" placeholder="••••••••" required autocomplete="current-password">
      </div>

      <button type="submit" class="btn-submit">Đăng nhập & Liên kết</button>
    </form>

    <div class="footer">
      Bảo mật bởi Smart Home Cloud &bull; HTTPS TLS 1.3
    </div>
  </div>
</body>
</html>`;
}

@SkipThrottle()
@Controller('integrations/google-home/oauth')
export class GoogleHomeOauthController {
  constructor(private readonly oauthService: GoogleHomeOauthService) {}

  @Get('authorize')
  getAuthorize(@Query() query: AuthorizeQueryParams, @Res() res: Response) {
    const clientId = query.client_id ?? '';
    const redirectUri = query.redirect_uri ?? '';
    const state = query.state ?? '';

    let errorMessage = '';
    if (clientId && !this.oauthService.validateClient(clientId)) {
      errorMessage = 'Client ID không hợp lệ cho liên kết Google Home.';
    }

    const html = renderHtmlLogin({
      clientId,
      redirectUri,
      state,
      errorMessage,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(HttpStatus.OK).send(html);
  }

  @Post('authorize')
  async postAuthorize(@Body() body: AuthorizeBody, @Res() res: Response) {
    const { email, password, client_id, redirect_uri, state } = body;

    const clientId = client_id ?? '';
    const redirectUri = redirect_uri ?? '';
    const stateVal = state ?? '';

    if (!this.oauthService.validateClient(clientId)) {
      const html = renderHtmlLogin({
        clientId,
        redirectUri,
        state: stateVal,
        errorMessage: 'Client ID không hợp lệ.',
        prefilledEmail: email,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(HttpStatus.BAD_REQUEST).send(html);
    }

    if (!email || !password) {
      const html = renderHtmlLogin({
        clientId,
        redirectUri,
        state: stateVal,
        errorMessage: 'Vui lòng nhập đầy đủ Email và Mật khẩu.',
        prefilledEmail: email,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(HttpStatus.BAD_REQUEST).send(html);
    }

    const user = await this.oauthService.authenticateUser(email, password);
    if (!user) {
      const html = renderHtmlLogin({
        clientId,
        redirectUri,
        state: stateVal,
        errorMessage: 'Email hoặc mật khẩu không chính xác.',
        prefilledEmail: email,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(HttpStatus.UNAUTHORIZED).send(html);
    }

    const code = await this.oauthService.generateAuthCode(user.id);
    const targetUrl = new URL(redirectUri);
    targetUrl.searchParams.set('code', code);
    if (stateVal) {
      targetUrl.searchParams.set('state', stateVal);
    }

    return res.redirect(HttpStatus.FOUND, targetUrl.toString());
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async postToken(
    @Body() body: TokenBody,
    @Headers('authorization') authHeader?: string,
  ) {
    let clientId = body.client_id;
    let clientSecret = body.client_secret;

    if (authHeader?.startsWith('Basic ')) {
      const credentials = Buffer.from(authHeader.slice(6), 'base64').toString(
        'utf8',
      );
      const [id, secret] = credentials.split(':');
      if (id) clientId = id;
      if (secret) clientSecret = secret;
    }

    if (body.grant_type === 'authorization_code') {
      if (!body.code) {
        return {
          error: 'invalid_request',
          error_description: 'Missing code parameter',
        };
      }
      return this.oauthService.exchangeCodeForTokens(
        body.code,
        clientId ?? '',
        clientSecret,
      );
    }

    if (body.grant_type === 'refresh_token') {
      if (!body.refresh_token) {
        return {
          error: 'invalid_request',
          error_description: 'Missing refresh_token parameter',
        };
      }
      return this.oauthService.refreshTokens(
        body.refresh_token,
        clientId ?? '',
        clientSecret,
      );
    }

    return {
      error: 'unsupported_grant_type',
      error_description: `Grant type ${body.grant_type} is not supported`,
    };
  }
}
