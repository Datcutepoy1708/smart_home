import { HttpStatus } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleHomeOauthController } from './google-home-oauth.controller.js';
import { GoogleHomeOauthService } from './google-home-oauth.service.js';

describe('GoogleHomeOauthController', () => {
  let controller: GoogleHomeOauthController;
  let oauthService: GoogleHomeOauthService;

  const mockOauthService = {
    validateClient: vi.fn(),
    authenticateUser: vi.fn(),
    generateAuthCode: vi.fn(),
    exchangeCodeForTokens: vi.fn(),
    refreshTokens: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleHomeOauthController],
      providers: [
        {
          provide: GoogleHomeOauthService,
          useValue: mockOauthService,
        },
      ],
    }).compile();

    controller = module.get<GoogleHomeOauthController>(
      GoogleHomeOauthController,
    );
    oauthService = module.get<GoogleHomeOauthService>(GoogleHomeOauthService);
  });

  describe('GET /authorize', () => {
    it('should render HTML login form with 200 OK', () => {
      mockOauthService.validateClient.mockReturnValue(true);

      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as any;

      controller.getAuthorize(
        {
          client_id: 'smart-home-google-client',
          redirect_uri: 'https://oauth-redirect.google.com/r/test',
          state: 'test-state-123',
        },
        res,
      );

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html; charset=utf-8',
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.send).toHaveBeenCalled();
      const html = res.send.mock.calls[0][0];
      expect(html).toContain('Smart Home IoT');
      expect(html).toContain('smart-home-google-client');
      expect(html).toContain('test-state-123');
    });
  });

  describe('POST /authorize', () => {
    it('should reject invalid client ID', async () => {
      mockOauthService.validateClient.mockReturnValue(false);

      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as any;

      await controller.postAuthorize(
        {
          email: 'admin@home.local',
          password: 'password',
          client_id: 'wrong-client',
          redirect_uri: 'https://oauth-redirect.google.com/r/test',
          state: 'state123',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const html = res.send.mock.calls[0][0];
      expect(html).toContain('Client ID không hợp lệ');
    });

    it('should reject invalid credentials', async () => {
      mockOauthService.validateClient.mockReturnValue(true);
      mockOauthService.authenticateUser.mockResolvedValue(null);

      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as any;

      await controller.postAuthorize(
        {
          email: 'admin@home.local',
          password: 'wrongpassword',
          client_id: 'smart-home-google-client',
          redirect_uri: 'https://oauth-redirect.google.com/r/test',
          state: 'state123',
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      const html = res.send.mock.calls[0][0];
      expect(html).toContain('Email hoặc mật khẩu không chính xác');
    });

    it('should redirect with auth code when credentials are valid', async () => {
      mockOauthService.validateClient.mockReturnValue(true);
      mockOauthService.authenticateUser.mockResolvedValue({
        id: 'user-uuid-123',
        email: 'admin@home.local',
      });
      mockOauthService.generateAuthCode.mockResolvedValue('sample-auth-code-xyz');

      const res = {
        redirect: vi.fn(),
      } as any;

      await controller.postAuthorize(
        {
          email: 'admin@home.local',
          password: 'correctpassword',
          client_id: 'smart-home-google-client',
          redirect_uri: 'https://oauth-redirect.google.com/r/test',
          state: 'state123',
        },
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        HttpStatus.FOUND,
        'https://oauth-redirect.google.com/r/test?code=sample-auth-code-xyz&state=state123',
      );
    });
  });

  describe('POST /token', () => {
    it('should exchange code for tokens', async () => {
      mockOauthService.exchangeCodeForTokens.mockResolvedValue({
        token_type: 'bearer',
        access_token: 'access-jwt-token',
        refresh_token: 'refresh-jwt-token',
        expires_in: 2592000,
      });

      const result = await controller.postToken({
        grant_type: 'authorization_code',
        code: 'valid-code',
        client_id: 'smart-home-google-client',
        client_secret: 'smarthome-secret-key-2026',
      });

      expect(result).toEqual({
        token_type: 'bearer',
        access_token: 'access-jwt-token',
        refresh_token: 'refresh-jwt-token',
        expires_in: 2592000,
      });
      expect(mockOauthService.exchangeCodeForTokens).toHaveBeenCalledWith(
        'valid-code',
        'smart-home-google-client',
        'smarthome-secret-key-2026',
      );
    });

    it('should handle refresh token grant', async () => {
      mockOauthService.refreshTokens.mockResolvedValue({
        token_type: 'bearer',
        access_token: 'new-access-jwt-token',
        expires_in: 2592000,
      });

      const result = await controller.postToken({
        grant_type: 'refresh_token',
        refresh_token: 'existing-refresh-token',
        client_id: 'smart-home-google-client',
        client_secret: 'smarthome-secret-key-2026',
      });

      expect(result).toEqual({
        token_type: 'bearer',
        access_token: 'new-access-jwt-token',
        expires_in: 2592000,
      });
    });
  });
});
