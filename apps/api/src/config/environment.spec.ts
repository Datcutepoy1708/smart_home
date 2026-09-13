import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

describe('validateEnvironment', () => {
  it('provides isolated defaults for tests', () => {
    const environment = validateEnvironment({ NODE_ENV: 'test' });
    expect(environment.JWT_ACCESS_TTL_SECONDS).toBe('900');
    expect(environment.BCRYPT_COST).toBe('12');
  });

  it('rejects a weak access secret outside tests', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost/test',
        MQTT_URL: 'mqtt://localhost:1883',
        JWT_ACCESS_SECRET: 'weak',
        JWT_REFRESH_SECRET: 'refresh-secret-at-least-32-characters',
      }),
    ).toThrow('JWT_ACCESS_SECRET must contain at least 32 characters');
  });
});
