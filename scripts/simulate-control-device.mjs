import { loadEnvFile } from "node:process";
import { connectAsync } from "mqtt";

loadEnvFile(new URL("../.env", import.meta.url));
const [householdId, deviceId] = process.argv.slice(2);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!uuid.test(householdId ?? "") || !uuid.test(deviceId ?? "")) {
  console.log("Usage: node scripts/simulate-control-device.mjs <householdId> <deviceId>");
  process.exit(1);
}

const root = process.env.MQTT_TOPIC_ROOT ?? "home";
const commandTopic = `${root}/${householdId}/device/${deviceId}/command`;
const ackTopic = `${root}/${householdId}/device/${deviceId}/state`;

console.log(`Simulating device ${deviceId}...`);
console.log(`Subscribing to: ${commandTopic}`);

const client = await connectAsync(process.env.MQTT_URL, {
  reconnectPeriod: 2000,
  connectTimeout: 5000,
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
});

let currentPower = "off";
let currentAngle = 0;
let currentPosition = "closed";

await client.subscribeAsync(commandTopic, { qos: 1 });
console.log(`Device ready and waiting for commands on ${commandTopic}`);

client.on("message", async (topic, message) => {
  if (topic === commandTopic) {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`Received command:`, payload);

      let ackState = {};
      if (payload.action === "open") {
        currentAngle = typeof payload.params?.angle === "number" ? payload.params.angle : 90;
        currentPosition = "open";
        ackState = { position: currentPosition, angle: currentAngle };
      } else if (payload.action === "close") {
        currentAngle = 0;
        currentPosition = "closed";
        ackState = { position: currentPosition, angle: currentAngle };
      } else if (payload.action === "set_angle" || typeof payload.params?.angle === "number") {
        currentAngle = Math.max(0, Math.min(180, Number(payload.params?.angle ?? 0)));
        currentPosition = currentAngle > 0 ? "open" : "closed";
        ackState = { position: currentPosition, angle: currentAngle };
      } else {
        const targetPower = payload.params?.power ?? (payload.action === "turn_on" ? "on" : "off");
        currentPower = targetPower;
        ackState = { power: currentPower };
      }

      const ackPayload = {
        schemaVersion: 1,
        commandId: payload.commandId,
        deviceId,
        status: "success",
        state: ackState,
        timestamp: new Date().toISOString(),
      };

      // Simulate a small hardware latency of 150ms before acknowledging
      setTimeout(async () => {
        await client.publishAsync(ackTopic, JSON.stringify(ackPayload), { qos: 1 });
        console.log(`Published ACK to ${ackTopic}:`, ackPayload);
      }, 150);
    } catch (err) {
      console.error("Failed to process command payload:", err);
    }
  }
});
