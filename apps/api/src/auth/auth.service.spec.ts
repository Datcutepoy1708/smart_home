import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcrypt';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const HOUSEHOLD_ID = '22222222-2222-4222-8222-222222222222';

function createService(overrides?: { user?: Record<string, unknown> | null }) {
  const user = overrides?.user ?? {
    id: USER_ID,
    name: 'Nguyen Van An',
    email: 'an@example.com',
    isActive: true,
    passwordHash: undefined,
    memberships: [
      {
        role: 'OWNER',
        household: { id: HOUSEHOLD_ID, name: "An's Home" },
      },
    ],
  };
  const transactionClient = {
    user: { create: vi.fn().mockResolvedValue(user) },
    household: {
      create: vi
        .fn()
        .mockResolvedValue({ id: HOUSEHOLD_ID, name: "An's Home" }),
    },
    householdMember: { create: vi.fn().mockResolvedValue({}) },
    refreshSession: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (tx: typeof transactionClient) => unknown) =>
        callback(transactionClient),
    ),
    refreshSession: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const users = {
    findByEmail: vi.fn().mockResolvedValue(user),
    findByIdWithMemberships: vi.fn().mockResolvedValue(user),
  };
  const config = new ConfigService({
    JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters',
    JWT_ACCESS_TTL_SECONDS: '900',
    JWT_REFRESH_TTL_SECONDS: '2592000',
    BCRYPT_COST: '10',
  });
  const service = new AuthService(
    prisma as unknown as PrismaService,
    users as unknown as UsersService,
    new JwtService(),
    config,
  );
  return { service, prisma, transactionClient, users };
}

describe('AuthService', () => {
  it('registers a normalized user and creates an owner household atomically', async () => {
    const { service, transactionClient } = createService();

    const result = await service.register({
      name: ' Nguyen Van An ',
      email: ' AN@Example.com ',
      password: 'strong-password',
      householdName: " An's Home ",
    });

    expect(transactionClient.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'an@example.com',
        name: 'Nguyen Van An',
      }),
    });
    expect(transactionClient.householdMember.create).toHaveBeenCalledWith({
      data: { householdId: HOUSEHOLD_ID, role: 'OWNER', userId: USER_ID },
    });
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
  });

  it('returns a generic error for an incorrect password', async () => {
    const passwordHash = await hash('correct-password', 10);
    const { service } = createService({
      user: {
        id: USER_ID,
        name: 'Nguyen Van An',
        email: 'an@example.com',
        isActive: true,
        passwordHash,
        memberships: [],
      },
    });

    await expect(
      service.login({ email: 'an@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(
      new UnauthorizedException('Email or password is incorrect'),
    );
  });
});
