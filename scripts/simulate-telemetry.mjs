import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { connectAsync } from "mqtt";
loadEnvFile(new URL("../.env", import.meta.url));
const [householdId, deviceId, temperature = "28.4", humidity = "67"] =
  process.argv.slice(2);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (
  !uuid.test(householdId ?? "") ||
  !uuid.test(deviceId ?? "") ||
  !Number.isFinite(Number(temperature)) ||
  !Number.isFinite(Number(humidity))
)
  throw new Error("Supply household UUID, device UUID, temperature, humidity");
if (
  !["localhost", "127.0.0.1"].includes(new URL(process.env.MQTT_URL).hostname)
)
  throw new Error("Local broker required");
const client = await connectAsync(process.env.MQTT_URL, {
  reconnectPeriod: 0,
  connectTimeout: 5000,
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
});
try {
  await client.publishAsync(
    `${process.env.MQTT_TOPIC_ROOT ?? "home"}/${householdId}/device/${deviceId}/telemetry`,
    JSON.stringify({
      schemaVersion: 1,
      messageId: randomUUID(),
      deviceId,
      timestamp: new Date().toISOString(),
      data: { temperature: Number(temperature), humidity: Number(humidity) },
    }),
    { qos: 1, retain: false },
  );
  console.log("Telemetry published.");
} finally {
  await client.endAsync();
}
