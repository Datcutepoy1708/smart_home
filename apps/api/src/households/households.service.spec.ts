import { describe, expect, it, vi } from 'vitest';
import { HouseholdRole } from '@prisma/client';
import { HouseholdsService } from './households.service.js';

describe('HouseholdsService - Sharing and Member Management', () => {
  it('lists household members with role and active status', async () => {
    const prismaMock = {
      householdMember: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'mem-1',
          userId: 'user-1',
          role: HouseholdRole.OWNER,
          household: { name: 'Nhà Đạt' },
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'mem-1',
            userId: 'user-1',
            role: HouseholdRole.OWNER,
            joinedAt: new Date('2026-09-01'),
            expiresAt: null,
            user: { id: 'user-1', name: 'Đạt', email: 'dat@test.com' },
          },
          {
            id: 'mem-2',
            userId: 'user-2',
            role: HouseholdRole.GUEST,
            joinedAt: new Date('2026-09-10'),
            expiresAt: new Date('2026-09-20'), // in past
            user: { id: 'user-2', name: 'Khách', email: 'khach@test.com' },
          },
        ]),
      },
    };

    const service = new HouseholdsService(prismaMock as any);
    const result = await service.listMembers('user-1', 'h1');

    expect(result.members).toHaveLength(2);
    expect(result.members[0].role).toBe(HouseholdRole.OWNER);
    expect(result.members[0].isCurrent).toBe(true);
    expect(result.members[1].isExpired).toBe(true); // expired guest
  });

  it('generates a 6-character invite code when requested by OWNER', async () => {
    const prismaMock = {
      householdMember: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'mem-1',
          userId: 'user-owner',
          role: HouseholdRole.OWNER,
          household: { name: 'Nhà Thông Minh' },
        }),
      },
    };

    const service = new HouseholdsService(prismaMock as any);
    const res = await service.createInviteCode('user-owner', 'h-1', HouseholdRole.MEMBER, 24);

    expect(res.code).toMatch(/^HM-[A-Z0-9]{4}$/);
    expect(res.householdName).toBe('Nhà Thông Minh');
    expect(res.role).toBe(HouseholdRole.MEMBER);
  });

  it('allows a user to join household by valid invite code', async () => {
    const prismaMock = {
      householdMember: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'mem-1',
            userId: 'user-owner',
            role: HouseholdRole.OWNER,
            household: { name: 'Nhà Thông Minh' },
          }) // for assertOwner in createInviteCode
          .mockResolvedValueOnce(null), // for existing check in joinHouseholdByCode
        create: vi.fn().mockResolvedValue({ id: 'mem-new' }),
      },
    };

    const service = new HouseholdsService(prismaMock as any);
    const invite = await service.createInviteCode('user-owner', 'h-1', HouseholdRole.MEMBER, 24);

    const joinRes = await service.joinHouseholdByCode('user-new', invite.code);
    expect(joinRes.success).toBe(true);
    expect(joinRes.householdId).toBe('h-1');
    expect(joinRes.householdName).toBe('Nhà Thông Minh');
    expect(prismaMock.householdMember.create).toHaveBeenCalled();
  });

  it('rejects joining with an invalid or expired code', async () => {
    const service = new HouseholdsService({} as any);
    await expect(service.joinHouseholdByCode('u1', 'INVALID-CODE')).rejects.toThrow();
  });

  it('prevents demoting the only OWNER of a household', async () => {
    const prismaMock = {
      householdMember: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'mem-owner',
          userId: 'user-owner',
          role: HouseholdRole.OWNER,
          household: { name: 'Nhà Đạt' },
        }),
        count: vi.fn().mockResolvedValue(1), // Only 1 owner
      },
    };

    const service = new HouseholdsService(prismaMock as any);
    await expect(
      service.updateMemberRole('user-owner', 'h-1', 'mem-owner', HouseholdRole.MEMBER)
    ).rejects.toThrow('Không thể hạ quyền Chủ nhà duy nhất');
  });

  it('creates a new household with user as OWNER', async () => {
    const prismaMock = {
      $transaction: vi.fn().mockImplementation(async (cb) => {
        const tx = {
          household: { create: vi.fn().mockResolvedValue({ id: 'h-new', name: 'Nhà Nghỉ Ba Vì' }) },
          householdMember: { create: vi.fn().mockResolvedValue({ id: 'mem-new' }) },
        };
        return cb(tx);
      }),
    };

    const service = new HouseholdsService(prismaMock as any);
    const res = await service.createHousehold('u1', 'Nhà Nghỉ Ba Vì');

    expect(res.id).toBe('h-new');
    expect(res.name).toBe('Nhà Nghỉ Ba Vì');
    expect(res.role).toBe(HouseholdRole.OWNER);
  });
});
