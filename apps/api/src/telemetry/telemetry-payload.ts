import { plainToInstance, Type } from 'class-transformer';
import {
  Equals,
  IsISO8601,
  IsNumber,
  IsObject,
  IsUUID,
  Max,
  Min,
  ValidateNested,
  validateSync,
} from 'class-validator';

class Readings {
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-40)
  @Max(80)
  temperature!: number;
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(100)
  humidity!: number;
}
class Envelope {
  @Equals(1) schemaVersion!: number;
  @IsUUID() messageId!: string;
  @IsUUID() deviceId!: string;
  @IsISO8601({ strict: true }) timestamp!: string;
  @IsObject() @ValidateNested() @Type(() => Readings) data!: Readings;
}

export function parseTelemetry(
  topic: string,
  payload: Buffer,
  root: string,
  maxBytes: number,
) {
  if (payload.length > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
  const parts = topic.split('/');
  if (
    parts.length !== 5 ||
    parts[0] !== root ||
    parts[2] !== 'device' ||
    parts[4] !== 'telemetry'
  )
    throw new Error('INVALID_TOPIC');
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(parts[1]) || !uuid.test(parts[3]))
    throw new Error('INVALID_TOPIC');
  let value: unknown;
  try {
    value = JSON.parse(payload.toString('utf8'));
  } catch {
    throw new Error('INVALID_JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_SCHEMA');
  const envelope = plainToInstance(Envelope, value);
  if (
    validateSync(envelope, { whitelist: true, forbidNonWhitelisted: true })
      .length ||
    !envelope.timestamp.endsWith('Z')
  )
    throw new Error('INVALID_SCHEMA');
  if (parts[3] !== envelope.deviceId) throw new Error('DEVICE_MISMATCH');
  return { householdId: parts[1], ...envelope };
}
