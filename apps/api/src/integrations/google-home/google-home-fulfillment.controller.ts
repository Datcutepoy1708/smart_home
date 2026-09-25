import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { GOOGLE_ACTIONS } from './google-home.constants.js';
import { GoogleHomeAuthGuard } from './google-home-auth.guard.js';
import { GoogleHomeService } from './google-home.service.js';

interface GoogleIntentInput {
  intent: string;
  payload?: any;
}

interface GoogleHomeRequest {
  requestId: string;
  inputs: GoogleIntentInput[];
}

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@SkipThrottle()
@Controller('integrations/google-home')
export class GoogleHomeFulfillmentController {
  constructor(private readonly googleHomeService: GoogleHomeService) {}

  @Post('fulfillment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(GoogleHomeAuthGuard)
  async handleFulfillment(
    @Body() body: GoogleHomeRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>> {
    const userId = req.user?.id;
    if (!userId) {
      return {
        requestId: body.requestId,
        payload: {
          errorCode: 'authFailure',
        },
      };
    }

    const input = body.inputs?.[0];
    if (!input) {
      return {
        requestId: body.requestId,
        payload: {
          errorCode: 'protocolError',
        },
      };
    }

    switch (input.intent) {
      case GOOGLE_ACTIONS.SYNC: {
        const payload = await this.googleHomeService.handleSync(userId);
        return {
          requestId: body.requestId,
          payload,
        };
      }

      case GOOGLE_ACTIONS.QUERY: {
        const targetDevices = input.payload?.devices ?? [];
        const payload = await this.googleHomeService.handleQuery(
          userId,
          targetDevices,
        );
        return {
          requestId: body.requestId,
          payload,
        };
      }

      case GOOGLE_ACTIONS.EXECUTE: {
        const commands = input.payload?.commands ?? [];
        const payload = await this.googleHomeService.handleExecute(
          userId,
          commands,
        );
        return {
          requestId: body.requestId,
          payload,
        };
      }

      case GOOGLE_ACTIONS.DISCONNECT: {
        await this.googleHomeService.handleDisconnect(userId);
        return {};
      }

      default: {
        return {
          requestId: body.requestId,
          payload: {
            errorCode: 'actionNotAvailable',
          },
        };
      }
    }
  }
}
