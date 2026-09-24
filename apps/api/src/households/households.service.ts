import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HouseholdRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  HouseholdMemberItemDto,
  InviteCodeResponseDto,
} from './household-members.dto.js';

interface InviteCodeRecord {
  code: string;
  householdId: string;
  householdName: string;
  role: HouseholdRole;
  expiresAt: Date;
  createdBy: string;
}

@Injectable()
export class HouseholdsService {
  // In-memory invite code storage (keyed by normalized code)
  private inviteCodes = new Map<string, InviteCodeRecord>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all households a user belongs to
   */
  async listForUser(userId: string) {
    const now = new Date();
    return this.prisma.householdMember.findMany({
      where: {
        userId,
        user: { isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { household: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /**
   * Helper: Assert caller belongs to household and return membership
   */
  private async assertMember(userId: string, householdId: string) {
    const now = new Date();
    const member = await this.prisma.householdMember.findFirst({
      where: {
        userId,
        householdId,
        user: { isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { household: true },
    });
    if (!member) {
      throw new ForbiddenException('Bạn không có quyền truy cập ngôi nhà này');
    }
    return member;
  }

  /**
   * Helper: Assert caller is OWNER of household
   */
  private async assertOwner(userId: string, householdId: string) {
    const member = await this.assertMember(userId, householdId);
    if (member.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Chỉ Chủ nhà (Owner) mới có quyền thực hiện thao tác này');
    }
    return member;
  }

  /**
   * List all members of a household
   */
  async listMembers(
    userId: string,
    householdId: string,
  ): Promise<{ members: HouseholdMemberItemDto[] }> {
    await this.assertMember(userId, householdId);

    const members = await this.prisma.householdMember.findMany({
      where: { householdId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [
        { role: 'asc' }, // OWNER first
        { joinedAt: 'asc' },
      ],
    });

    const now = new Date();
    const mapped: HouseholdMemberItemDto[] = members.map((m) => {
      const isExpired = m.expiresAt ? m.expiresAt < now : false;
      return {
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
        isExpired,
        isCurrent: m.userId === userId,
      };
    });

    return { members: mapped };
  }

  /**
   * Generate an invite code (6 characters) for household
   */
  async createInviteCode(
    userId: string,
    householdId: string,
    role: HouseholdRole = HouseholdRole.MEMBER,
    validHours = 24,
  ): Promise<InviteCodeResponseDto> {
    const owner = await this.assertOwner(userId, householdId);

    // Generate readable 6-character code (e.g. HM-4921 or HM-8X2K)
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `HM-${randomPart}`;

    const expiresAt = new Date(Date.now() + Math.max(1, validHours) * 3600 * 1000);

    const record: InviteCodeRecord = {
      code,
      householdId,
      householdName: owner.household.name,
      role,
      expiresAt,
      createdBy: userId,
    };

    this.inviteCodes.set(code, record);

    return {
      code,
      householdId,
      householdName: owner.household.name,
      role,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Join a household using an invite code
   */
  async joinHouseholdByCode(
    userId: string,
    rawCode: string,
  ): Promise<{ success: boolean; householdId: string; householdName: string; role: string }> {
    const code = rawCode.trim().toUpperCase();
    const invite = this.inviteCodes.get(code);

    if (!invite) {
      throw new NotFoundException('Mã mời không tồn tại hoặc đã hết hiệu lực.');
    }

    if (invite.expiresAt < new Date()) {
      this.inviteCodes.delete(code);
      throw new BadRequestException('Mã mời đã hết hạn sử dụng. Vui lòng xin mã mới từ Chủ nhà.');
    }

    // Check if user is already a member
    const existing = await this.prisma.householdMember.findFirst({
      where: { householdId: invite.householdId, userId },
    });

    if (existing) {
      throw new ConflictException('Bạn đã là thành viên của ngôi nhà này rồi.');
    }

    // If invited as GUEST, set expiry (e.g. 7 days from now or matching invite TTL)
    const guestExpiry =
      invite.role === HouseholdRole.GUEST
        ? new Date(Date.now() + 7 * 24 * 3600 * 1000)
        : null;

    await this.prisma.householdMember.create({
      data: {
        householdId: invite.householdId,
        userId,
        role: invite.role,
        invitedBy: invite.createdBy,
        expiresAt: guestExpiry,
      },
    });

    return {
      success: true,
      householdId: invite.householdId,
      householdName: invite.householdName,
      role: invite.role,
    };
  }

  /**
   * Update member role or expiration
   */
  async updateMemberRole(
    userId: string,
    householdId: string,
    memberId: string,
    newRole: HouseholdRole,
    expiresAtString?: string | null,
  ) {
    await this.assertOwner(userId, householdId);

    const target = await this.prisma.householdMember.findFirst({
      where: { id: memberId, householdId },
    });

    if (!target) {
      throw new NotFoundException('Không tìm thấy thành viên trong ngôi nhà.');
    }

    // If demoting an OWNER, ensure there is at least one other OWNER
    if (target.role === HouseholdRole.OWNER && newRole !== HouseholdRole.OWNER) {
      const ownerCount = await this.prisma.householdMember.count({
        where: { householdId, role: HouseholdRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Không thể hạ quyền Chủ nhà duy nhất của ngôi nhà.');
      }
    }

    let parsedExpiresAt: Date | null = null;
    if (newRole === HouseholdRole.GUEST) {
      parsedExpiresAt = expiresAtString
        ? new Date(expiresAtString)
        : new Date(Date.now() + 7 * 24 * 3600 * 1000);
    }

    const updated = await this.prisma.householdMember.update({
      where: { id: memberId },
      data: {
        role: newRole,
        expiresAt: parsedExpiresAt,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
      expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
    };
  }

  /**
   * Remove member or leave household
   */
  async removeMember(
    userId: string,
    householdId: string,
    memberId: string,
  ): Promise<{ success: boolean; memberId: string }> {
    const caller = await this.assertMember(userId, householdId);
    const target = await this.prisma.householdMember.findFirst({
      where: { id: memberId, householdId },
    });

    if (!target) {
      throw new NotFoundException('Không tìm thấy thành viên cần xóa.');
    }

    // Caller must be OWNER, or caller is removing themselves
    const isSelf = target.userId === userId;
    if (!isSelf && caller.role !== HouseholdRole.OWNER) {
      throw new ForbiddenException('Chỉ Chủ nhà mới có quyền xóa thành viên khác.');
    }

    // Prevent removing the last owner
    if (target.role === HouseholdRole.OWNER) {
      const ownerCount = await this.prisma.householdMember.count({
        where: { householdId, role: HouseholdRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Chủ nhà duy nhất không thể rời khỏi ngôi nhà.');
      }
    }

    await this.prisma.householdMember.delete({
      where: { id: memberId },
    });

    return { success: true, memberId };
  }

  /**
   * Create a new household with user as OWNER
   */
  async createHousehold(
    userId: string,
    name: string,
  ): Promise<{ id: string; name: string; role: string }> {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new BadRequestException('Tên ngôi nhà không được để trống.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const house = await tx.household.create({
        data: {
          name: cleanName,
          createdBy: userId,
        },
      });

      await tx.householdMember.create({
        data: {
          householdId: house.id,
          userId,
          role: HouseholdRole.OWNER,
        },
      });

      return house;
    });

    return {
      id: created.id,
      name: created.name,
      role: HouseholdRole.OWNER,
    };
  }
}
