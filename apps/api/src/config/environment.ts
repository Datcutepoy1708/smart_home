type Environment = Record<string, string | undefined>;

const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'MQTT_URL',
] as const;

const TEST_DEFAULTS: Environment = {
  JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters',
};

function parseInteger(
  environment: Environment,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): string {
  const value = Number(environment[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return String(value);
}

export function validateEnvironment(environment: Environment): Environment {
  const values =
    environment.NODE_ENV === 'test'
      ? { ...TEST_DEFAULTS, ...environment }
      : environment;
  const port = Number(values.PORT ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  if (values.NODE_ENV !== 'test') {
    for (const name of REQUIRED_IN_PRODUCTION) {
      if (!values[name]) {
        throw new Error(`${name} is required`);
      }
    }
  }

  for (const secretName of [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ] as const) {
    const secret = values[secretName];
    if (secret && secret.length < 32) {
      throw new Error(`${secretName} must contain at least 32 characters`);
    }
  }

  if (
    values.MQTT_TOPIC_ROOT &&
    !/^[a-zA-Z0-9_-]+$/.test(values.MQTT_TOPIC_ROOT)
  )
    throw new Error('MQTT_TOPIC_ROOT must be one topic segment');
  if (values.MQTT_URL) {
    let url: URL;
    try {
      url = new URL(values.MQTT_URL);
    } catch {
      throw new Error('MQTT_URL is invalid');
    }
    if (!['mqtt:', 'mqtts:'].includes(url.protocol))
      throw new Error('MQTT_URL must use MQTT');
    if (
      values.NODE_ENV === 'production' &&
      values.ENFORCE_MQTT_TLS === 'true' &&
      url.protocol !== 'mqtts:'
    )
      throw new Error('MQTT_URL must use TLS in production');
  }
  if (values.DATABASE_URL) {
    let url: URL;
    try {
      url = new URL(values.DATABASE_URL);
    } catch {
      throw new Error('DATABASE_URL is invalid');
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol))
      throw new Error('DATABASE_URL must use PostgreSQL');
    if (!url.searchParams.has('connect_timeout'))
      url.searchParams.set('connect_timeout', '5');
    if (!url.searchParams.has('socket_timeout'))
      url.searchParams.set('socket_timeout', '10');
    values.DATABASE_URL = url.toString();
  }
  return {
    ...values,
    DB_TRANSACTION_MAX_WAIT_MS: parseInteger(
      values,
      'DB_TRANSACTION_MAX_WAIT_MS',
      5000,
      1000,
      30000,
    ),
    DB_TRANSACTION_TIMEOUT_MS: parseInteger(
      values,
      'DB_TRANSACTION_TIMEOUT_MS',
      10000,
      1000,
      60000,
    ),
    MQTT_TOPIC_ROOT: values.MQTT_TOPIC_ROOT ?? 'home',
    MQTT_CONNECT_TIMEOUT_MS: parseInteger(
      values,
      'MQTT_CONNECT_TIMEOUT_MS',
      5000,
      1000,
      30000,
    ),
    MQTT_RECONNECT_MIN_MS: parseInteger(
      values,
      'MQTT_RECONNECT_MIN_MS',
      1000,
      100,
      10000,
    ),
    MQTT_RECONNECT_MAX_MS: parseInteger(
      values,
      'MQTT_RECONNECT_MAX_MS',
      30000,
      10000,
      120000,
    ),
    MQTT_MAX_INFLIGHT: parseInteger(values, 'MQTT_MAX_INFLIGHT', 16, 1, 100),
    DEVICE_OFFLINE_AFTER_MS: parseInteger(
      values,
      'DEVICE_OFFLINE_AFTER_MS',
      60000,
      1000,
      3600000,
    ),
    DEVICE_STATUS_INTERVAL_MS: parseInteger(
      values,
      'DEVICE_STATUS_INTERVAL_MS',
      10000,
      1000,
      60000,
    ),
    PORT: String(port),
    BCRYPT_COST: parseInteger(values, 'BCRYPT_COST', 12, 10, 15),
    JWT_ACCESS_TTL_SECONDS: parseInteger(
      values,
      'JWT_ACCESS_TTL_SECONDS',
      900,
      60,
      86_400,
    ),
    JWT_REFRESH_TTL_SECONDS: parseInteger(
      values,
      'JWT_REFRESH_TTL_SECONDS',
      2_592_000,
      3_600,
      31_536_000,
    ),
    MQTT_MAX_PAYLOAD_BYTES: parseInteger(
      values,
      'MQTT_MAX_PAYLOAD_BYTES',
      16_384,
      1_024,
      1_048_576,
    ),
  };
}
