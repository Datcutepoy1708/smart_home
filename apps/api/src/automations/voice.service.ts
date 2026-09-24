import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CommandSource, DeviceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CommandsService } from '../devices/commands.service.js';
import { ScenesService } from './scenes.service.js';
import type { VoiceCommandDto, VoiceResponseDto } from './voice.dto.js';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: CommandsService,
    private readonly scenes: ScenesService,
  ) {}

  private async assertMembership(userId: string, householdId: string) {
    const now = new Date();
    const membership = await this.prisma.householdMember.findFirst({
      where: {
        userId,
        householdId,
        user: { isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (!membership) throw new ForbiddenException('Household access denied');
    return membership;
  }

  private stripAccents(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase();
  }

  async processVoiceCommand(
    userId: string,
    householdId: string,
    dto: VoiceCommandDto,
  ): Promise<VoiceResponseDto> {
    await this.assertMembership(userId, householdId);

    const raw = dto.text.trim();
    const clean = this.stripAccents(raw);

    this.logger.log(`Processing voice command: "${raw}" (normalized: "${clean}")`);

    // 1. Check for Sensor / Environment queries (Nhiệt độ, độ ẩm)
    if (
      clean.includes('nhiet do') ||
      clean.includes('do am') ||
      clean.includes('thoi tiet') ||
      clean.includes('nong khong') ||
      clean.includes('may do') ||
      clean.includes('bao nhieu do')
    ) {
      const readings = await this.prisma.sensorReading.findMany({
        where: { device: { householdId } },
        orderBy: { recordedAt: 'desc' },
        take: 10,
      });

      const temp = readings.find((r) => r.metric === 'temperature');
      const humid = readings.find((r) => r.metric === 'humidity');

      if (temp || humid) {
        const tVal = temp ? Number(temp.value).toFixed(1) : '--';
        const hVal = humid ? Number(humid.value).toFixed(0) : '--';
        return {
          success: true,
          transcript: raw,
          matchedType: 'QUERY',
          message: `Nhiệt độ hiện tại là ${tVal}°C, độ ẩm ${hVal}%.`,
          data: { temperature: tVal, humidity: hVal },
        };
      }

      return {
        success: true,
        transcript: raw,
        matchedType: 'QUERY',
        message: 'Hiện chưa có dữ liệu cảm biến mới nhất.',
      };
    }

    // 2. Check for Scene Triggers (Về nhà, Rời nhà, Đi ngủ, Tiếp khách)
    const allScenes = await this.scenes.listScenes(userId, householdId);

    if (
      clean.includes('ve nha') ||
      clean.includes('toi ve roi') ||
      clean.includes('da ve') ||
      clean.includes('coming home')
    ) {
      const targetScene = allScenes.find((s) =>
        this.stripAccents(s.name).includes('ve nha'),
      );
      if (targetScene) {
        await this.scenes.triggerScene(userId, householdId, targetScene.id);
        return {
          success: true,
          transcript: raw,
          matchedType: 'SCENE',
          message: 'Chào mừng bạn về nhà! Đã mở cửa, bật đèn và quạt.',
        };
      }
    }

    if (
      clean.includes('roi nha') ||
      clean.includes('ra ngoai') ||
      clean.includes('di lam') ||
      clean.includes('leaving')
    ) {
      const targetScene = allScenes.find((s) =>
        this.stripAccents(s.name).includes('roi nha'),
      );
      if (targetScene) {
        await this.scenes.triggerScene(userId, householdId, targetScene.id);
        return {
          success: true,
          transcript: raw,
          matchedType: 'SCENE',
          message: 'Đã kích hoạt chế độ rời nhà: tắt đèn, tắt quạt và đóng cửa an toàn.',
        };
      }
    }

    if (
      clean.includes('di ngu') ||
      clean.includes('ngu ngon') ||
      clean.includes('sleep')
    ) {
      const targetScene = allScenes.find((s) =>
        this.stripAccents(s.name).includes('di ngu'),
      );
      if (targetScene) {
        await this.scenes.triggerScene(userId, householdId, targetScene.id);
        return {
          success: true,
          transcript: raw,
          matchedType: 'SCENE',
          message: 'Chúc bạn ngủ ngon! Đã đóng cửa và tắt đèn.',
        };
      }
    }

    // 3. Check for Device Control (Cửa, Quạt, Đèn)
    // Identify target device type
    let targetType: DeviceType | null = null;
    if (
      clean.includes('cua') ||
      clean.includes('door') ||
      clean.includes('servo')
    ) {
      targetType = DeviceType.DOOR_SERVO;
    } else if (
      clean.includes('quat') ||
      clean.includes('fan') ||
      clean.includes('gio')
    ) {
      targetType = DeviceType.FAN;
    } else if (
      clean.includes('den') ||
      clean.includes('light') ||
      clean.includes('bong den') ||
      clean.includes('chieu sang')
    ) {
      targetType = DeviceType.LIGHT;
    }

    if (targetType) {
      const device = await this.prisma.device.findFirst({
        where: { householdId, deviceType: targetType },
      });

      if (!device) {
        return {
          success: false,
          transcript: raw,
          matchedType: 'DEVICE',
          message: `Không tìm thấy thiết bị phù hợp trong nhà.`,
        };
      }

      // Identify action
      let action: 'turn_on' | 'turn_off' | 'open' | 'close' | null = null;
      let angle = 90;

      // Check angles for door
      const angleMatch = clean.match(/(\d{1,3})\s*(?:do|deg|degree|°)?/);
      if (angleMatch) {
        const parsedAngle = parseInt(angleMatch[1], 10);
        if (parsedAngle >= 0 && parsedAngle <= 180) {
          angle = parsedAngle;
        }
      }

      if (targetType === DeviceType.DOOR_SERVO) {
        if (
          clean.includes('mo') ||
          clean.includes('open') ||
          clean.includes('ra')
        ) {
          action = 'open';
        } else if (
          clean.includes('dong') ||
          clean.includes('khep') ||
          clean.includes('close') ||
          clean.includes('khoa')
        ) {
          action = 'close';
          angle = 0;
        } else if (angleMatch) {
          // e.g. "Cửa 90 độ"
          action = angle > 0 ? 'open' : 'close';
        }
      } else {
        if (
          clean.includes('bat') ||
          clean.includes('on') ||
          clean.includes('mo') ||
          clean.includes('chay')
        ) {
          action = 'turn_on';
        } else if (
          clean.includes('tat') ||
          clean.includes('off') ||
          clean.includes('dung') ||
          clean.includes('ngat')
        ) {
          action = 'turn_off';
        }
      }

      if (action) {
        try {
          await this.commands.executeCommand(
            userId,
            householdId,
            device.id,
            {
              action: action as any,
              ...(targetType === DeviceType.DOOR_SERVO ? { angle } : {}),
            },
            CommandSource.VOICE,
          );

          let friendlyAction = '';
          if (action === 'open') friendlyAction = `mở cửa góc ${angle}°`;
          else if (action === 'close') friendlyAction = 'đóng cửa';
          else if (action === 'turn_on') friendlyAction = `bật ${device.name}`;
          else friendlyAction = `tắt ${device.name}`;

          return {
            success: true,
            transcript: raw,
            matchedType: 'DEVICE',
            deviceName: device.name,
            action,
            angle: targetType === DeviceType.DOOR_SERVO ? angle : undefined,
            message: `Đã ${friendlyAction} thành công!`,
          };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Thiết bị không phản hồi';
          return {
            success: false,
            transcript: raw,
            matchedType: 'DEVICE',
            deviceName: device.name,
            message: `Không thể điều khiển ${device.name}: ${errMsg}`,
          };
        }
      }
    }

    // Fallback: If no intent was recognized
    return {
      success: false,
      transcript: raw,
      matchedType: 'UNKNOWN',
      message:
        'Xin lỗi, tôi chưa hiểu câu lệnh. Bạn có thể nói: "Mở cửa 90 độ", "Bật quạt", "Tắt đèn" hoặc "Về nhà".',
    };
  }
}
