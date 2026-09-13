import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByIdWithMemberships(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: { household: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
  }
}
