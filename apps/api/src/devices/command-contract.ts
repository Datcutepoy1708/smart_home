import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ExecuteCommandDto } from './execute-command.dto.js';

export function commandParams(
  deviceType: string,
  action: ExecuteCommandDto['action'],
  angle?: number,
) {
  if (deviceType === 'DOOR_SERVO') {
    if (action === 'open') {
      const targetAngle = typeof angle === 'number' ? angle : 90;
      return { position: 'open', angle: targetAngle };
    }
    if (action === 'close') {
      return { position: 'closed', angle: 0 };
    }
    if (action === 'set_angle') {
      const targetAngle = typeof angle === 'number' ? angle : 0;
      return {
        position: targetAngle === 0 ? 'closed' : 'open',
        angle: targetAngle,
      };
    }
  }
  if (['LIGHT', 'FAN'].includes(deviceType) && (action === 'turn_on' || action === 'turn_off'))
    return { power: action === 'turn_on' ? 'on' : 'off' };
  throw new BadRequestException('Action is not supported by this device type');
}

export function confirmedCommandState(deviceType: string, value: unknown): Record<string, string | number> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ConflictException('Device did not report a valid state');
  const state = value as Record<string, unknown>;
  if (deviceType === 'DOOR_SERVO') {
    if (state.position !== 'open' && state.position !== 'closed')
      throw new ConflictException('Invalid door position in ACK');
    if (state.angle !== undefined && (typeof state.angle !== 'number'
      || !Number.isInteger(state.angle) || state.angle < 0 || state.angle > 180))
      throw new ConflictException('Invalid servo angle in ACK');
    return { position: state.position, ...(typeof state.angle === 'number' ? { angle: state.angle } : {}) };
  }
  if (state.power !== 'on' && state.power !== 'off')
    throw new ConflictException('Invalid power state in ACK');
  return { power: state.power };
}
