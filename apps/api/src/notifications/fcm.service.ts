import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getMessaging, type SendResponse } from 'firebase-admin/messaging';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private firebaseApp: App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    let privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase Admin SDK credentials not fully configured (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY). Push notifications disabled.',
      );
      return;
    }

    try {
      privateKey = privateKey.trim();
      // Remove wrapping quotes if present from env string
      if (
        (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
        (privateKey.startsWith("'") && privateKey.endsWith("'"))
      ) {
        privateKey = privateKey.slice(1, -1);
      }

      // Normalize escaped newlines if passed through environment variables
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }

      const existingApps = getApps();
      if (existingApps.length > 0) {
        this.firebaseApp = existingApps[0];
      } else {
        this.firebaseApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }
      this.logger.log(`Firebase Admin initialized successfully for project: ${projectId}`);
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error);
    }
  }

  isReady(): boolean {
    return this.firebaseApp !== null;
  }

  async sendToTokens(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<PushResult> {
    if (!this.firebaseApp || tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const messaging = getMessaging(this.firebaseApp);
    const uniqueTokens = [...new Set(tokens)];
    const invalidTokens: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Firebase messaging limits sendEachForMulticast to 500 tokens per batch
    const batchSize = 500;
    for (let i = 0; i < uniqueTokens.length; i += batchSize) {
      const batchTokens = uniqueTokens.slice(i, i + batchSize);

      try {
        const response = await messaging.sendEachForMulticast({
          tokens: batchTokens,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data,
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'smart_home_alerts',
              priority: 'high',
            },
          },
        });

        successCount += response.successCount;
        failureCount += response.failureCount;

        response.responses.forEach((resp: SendResponse, idx: number) => {
          if (!resp.success && resp.error) {
            const errorCode = resp.error.code;
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(batchTokens[idx]);
            } else {
              this.logger.warn(`FCM delivery failed for token: ${resp.error.message}`);
            }
          }
        });
      } catch (err) {
        this.logger.error('Error executing sendEachForMulticast:', err);
        failureCount += batchTokens.length;
      }
    }

    return {
      successCount,
      failureCount,
      invalidTokens,
    };
  }
}
