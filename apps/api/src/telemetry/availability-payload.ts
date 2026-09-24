import { isUUID } from 'class-validator';

export function parseAvailability(topic: string, payload: Buffer, root: string, maxBytes: number) {
  if (payload.length > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
  const parts = topic.split('/');
  if (parts.length !== 5 || parts[0] !== root || parts[2] !== 'device'
    || parts[4] !== 'availability' || !isUUID(parts[1]) || !isUUID(parts[3]))
    throw new Error('INVALID_TOPIC');
  const value: unknown = JSON.parse(payload.toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_SCHEMA');
  const data = value as Record<string, unknown>;
  if (data.schemaVersion !== 1 || data.deviceId !== parts[3] || typeof data.online !== 'boolean'
    || Object.keys(data).some(key => !['schemaVersion', 'deviceId', 'online', 'timestamp'].includes(key)))
    throw new Error('INVALID_SCHEMA');
  return { householdId: parts[1], deviceId: parts[3], online: data.online };
}
