import { createServer } from "node:http";
import { InfraiError, InfraiRealtime } from "./infrai_realtime.js";
import { decidePaymentNotification, paymentEventSchema } from "./payment_policy.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const realtime = new InfraiRealtime(apiKey);

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/payment-events") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const payment = paymentEventSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const notification = decidePaymentNotification(payment);
    const channel = `user:${payment.userId}:payments`;

    await realtime.publish(
      channel,
      notification.event,
      notification.data,
      payment.accountId,
      `payment-notification:${payment.paymentId}:${notification.event}`
    );

    sendJson(response, 202, {
      accepted: true,
      channel,
      notificationId: notification.data.notificationId,
      decision: notification.data.audit.decision
    });
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code });
      return;
    }
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) {
      sendJson(response, 400, { error: "Invalid payment event" });
      return;
    }
    sendJson(response, 500, { error: "Notification delivery failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Payment notification service listening on ${port}`));
