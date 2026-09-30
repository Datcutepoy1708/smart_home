import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { FcmService } from './fcm.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [FcmService, NotificationsService],
  exports: [FcmService, NotificationsService],
})
export class NotificationsModule {}
