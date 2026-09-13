import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.householdMember.findMany({
      where: { userId },
      include: { household: true },
      orderBy: { joinedAt: 'asc' },
    });
  }
}
