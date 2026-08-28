import { InfraiRealtime } from "./infrai_realtime.js";

const apiKey = process.env.INFRAI_API_KEY;
const userId = process.env.DEMO_USER_ID ?? "user-42";
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running setup");

const channel = `user:${userId}:payments`;
const realtime = new InfraiRealtime(apiKey);

await realtime.createChannel(channel, `create:${channel}`);
const token = await realtime.issueToken(userId, [channel], `token:${userId}:${channel}`);

console.log(JSON.stringify({ channel, token }, null, 2));
