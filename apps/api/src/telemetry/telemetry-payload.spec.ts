import { describe, it, expect } from 'vitest';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { parseTelemetry } from './telemetry-payload.js';
const deviceId = randomUUID();
const topic = `home/${randomUUID()}/device/${deviceId}/telemetry`;
const valid = {
  schemaVersion: 1,
  messageId: randomUUID(),
  deviceId,
  timestamp: new Date().toISOString(),
  data: { temperature: 28.4, humidity: 67 },
};
const parse = (value: unknown) =>
  parseTelemetry(topic, Buffer.from(JSON.stringify(value)), 'home', 16384);
describe('telemetry contract', () => {
  it('accepts explicit temperature and humidity numbers', () =>
    expect(parse(valid).data).toEqual(valid.data));
  it.each([
    null,
    [],
    {},
    { ...valid, data: {} },
    { ...valid, schemaVersion: 2 },
    { ...valid, deviceId: randomUUID() },
    { ...valid, data: { temperature: '28', humidity: 50 } },
    { ...valid, data: { temperature: 28, humidity: 101 } },
    { ...valid, data: { ...valid.data, unit: 'F' } },
    { ...valid, timestamp: 'bad' },
  ])('rejects invalid input %#', (value) =>
    expect(() => parse(value)).toThrow(),
  );
  it('rejects malformed JSON and oversized payloads', () => {
    expect(() =>
      parseTelemetry(topic, Buffer.from('{'), 'home', 16384),
    ).toThrow();
    expect(() =>
      parseTelemetry(topic, Buffer.alloc(16385), 'home', 16384),
    ).toThrow();
  });
});
