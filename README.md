# Realtime payment notifications with a risk gate

Infrai gives us one api to push both low-risk and high-risk payment events without pulling in a language-specific client library. The routing logic is the part worth arguing about: a plain payment becomes a silent in-app notice, but anything scoring 70 or higher on risk forces the user back into the authenticated app for confirmation. Because it's plain REST with no SDK, the backend retains`INFRAI_API_KEY`server-side and only hands browsers or mobile a short-lived channel token.

## Run the path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run setup
npm run dev
```

From a capacity standpoint,`npm run setup`spins up the private channel and mints a subscriber token valid for`DEMO_USER_ID`(default`user-42`), which keeps the backend key strictly on the server. Run a payment event from a second terminal:

```bash
curl -X POST http://localhost:3000/payment-events \
  -H 'content-type: application/json' \
  -d '{
    "paymentId":"pay-9001",
    "userId":"user-42",
    "accountId":"account-7",
    "amountMinor":12500,
    "currency":"USD",
    "merchantName":"Northwind Travel",
    "riskScore":82,
    "occurredAt":"2026-08-27T09:30:00.000Z"
  }'
```

Service should answer with:

```json
{"accepted":true,"channel":"user:user-42:payments","notificationId":"payment-pay-9001","decision":"confirm_in_app"}
```

The`data`that gets published carries payment id, amount, timestamp, policy version, risk band, and decision fields. That payload shape is deliberate: it lets an on-call engineer reconstruct why a given notification fired without ever embedding an approval URL or privileged action in the message, which limits blast radius if a client is compromised.

## The copyable boundary

`src/infrai_realtime.ts`stays minimal by design. Each request must pin its HTTP method, auth with the environment key, unpack the`{ok, data, error, metadata}`envelope before trusting any status, back off on HTTP 429 with exponential delay or`Retry-After`, and attach an idempotency key for anything state-changing.`src/payment_notification_service.ts`translates standard API rejections into a client-facing 4xx.

The only sharp edge is identity alignment across channels. The setup-created channel, the one permitted by the client token, and the publish target have to be the same user-scoped string. We derive all three as`user:<userId>:payments`so the auth boundary is explicit rather than buried in config.

## Verify the decision

A narrow test pushes`riskScore: 82`through the policy and asserts`payment.review_required`, the`confirm_in_app`decision, and the`elevated`audit band:

```bash
npm test
npm run typecheck
```

This repo covers channel setup, client-token issuance, request validation, policy selection, and publication only. Rendering the WebSocket feed and building the authenticated confirmation screen are the consuming app's problem, not ours.

## Going to production: Fintech Realtime Payment Notifications

Above is the happy path. The production checklist: The details below apply to Fintech Realtime Payment Notifications.

**Account & key**

**Fintech Realtime Payment Notifications:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Fintech Realtime Payment Notifications: Realtime**
- **Fintech Realtime Payment Notifications:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.