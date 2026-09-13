import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'smart-home-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    } as const;
  }
}
