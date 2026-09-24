import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { parseAvailability } from './availability-payload.js';

const householdId = randomUUID();
const deviceId = randomUUID();
const topic = `home/${householdId}/device/${deviceId}/availability`;
const valid = { schemaVersion: 1, deviceId, online: true };
const parse = (value: unknown) => parseAvailability(topic, Buffer.from(JSON.stringify(value)), 'home', 1024);
describe('hardware availability contract', () => {
  it('accepts online and explicit offline', () => {
    expect(parse(valid)).toEqual({ householdId, deviceId, online: true });
    expect(parse({ ...valid, online: false }).online).toBe(false);
  });
  it.each([null, [], {}, { ...valid, schemaVersion: 2 },
    { ...valid, deviceId: randomUUID() }, { ...valid, online: 'true' },
    { ...valid, extra: 1 }])('rejects malformed envelopes %#', value => {
    expect(() => parse(value)).toThrow();
  });
  it('rejects malformed topics, JSON and oversized messages', () => {
    expect(() => parseAvailability('home/bad/device/bad/availability', Buffer.from('{}'), 'home', 1024)).toThrow();
    expect(() => parseAvailability(topic, Buffer.from('{'), 'home', 1024)).toThrow();
    expect(() => parseAvailability(topic, Buffer.alloc(1025), 'home', 1024)).toThrow();
  });
});
