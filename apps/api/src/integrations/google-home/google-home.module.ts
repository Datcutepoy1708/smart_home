import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DevicesModule } from '../../devices/devices.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { UsersModule } from '../../users/users.module.js';
import { GoogleHomeAuthGuard } from './google-home-auth.guard.js';
import { GoogleHomeFulfillmentController } from './google-home-fulfillment.controller.js';
import { GoogleHomeOauthController } from './google-home-oauth.controller.js';
import { GoogleHomeOauthService } from './google-home-oauth.service.js';
import { GoogleHomeService } from './google-home.service.js';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    DevicesModule,
    UsersModule,
  ],
  controllers: [
    GoogleHomeOauthController,
    GoogleHomeFulfillmentController,
  ],
  providers: [
    GoogleHomeOauthService,
    GoogleHomeService,
    GoogleHomeAuthGuard,
  ],
  exports: [
    GoogleHomeService,
    GoogleHomeOauthService,
  ],
})
export class GoogleHomeModule {}
