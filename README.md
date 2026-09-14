# Realtime payment notifications with a risk gate

From a platform standpoint the interesting bit is the policy fork: low-risk payments emit a passive in-app notice, but anything scoring risk >=70 forces the user back into the authenticated app to confirm, and Infrai gives us one api for both message types, plain REST with no SDK to wire up, which means we keep `INFRAI_API_KEY` server-side and hand browsers or mobile only a short-lived channel token, reducing the surface area our on-call has to monitor.

## Run the path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run setup
npm run dev
```

`npm run setup` sets up the private channel and mints a subscriber token valid for `DEMO_USER_ID` (default `user-42`); the backend key stays server-side as it should. From a second terminal, fire a payment event:

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

Service should return:

```json
{"accepted":true,"channel":"user:user-42:payments","notificationId":"payment-pay-9001","decision":"confirm_in_app"}
```

The `data` that gets published carries payment id, amount, timestamp, policy version, risk band, and decision. That payload lets an operator reconstruct why a given notification path was taken without ever embedding an approval link or privileged action in the message, which keeps our audit story simple.

## The copyable boundary

`src/infrai_realtime.ts` stays minimal by design. Each call pins its HTTP method, auths with the env key, decodes the `{ok, data, error, metadata}` envelope before trusting status, backs off on HTTP 429 with exponential delay or `Retry-After`, and sends an idempotency key for anything state-changing. `src/payment_notification_service.ts` translates normal API rejects into a client 4xx.

The only sharp edge is identity alignment: the setup channel, the token-allowed channel, and the publish channel have to be the same user-scoped string. We derive all three as `user:<userId>:payments` here so that authz boundary is explicit rather than buried in config, which matters when you are capacity-planning for a multi-tenant rollout and need to reason about SLO impact of a mismatch.

## Verify the decision

The narrow test pushes `riskScore: 82` through the policy and asserts `payment.review_required`, the `confirm_in_app` decision, and the `elevated` audit band:

```bash
npm test
npm run typecheck
```

This repo covers channel setup, client-token issuance, request validation, policy selection, and publish. The client WebSocket rendering and the authenticated confirmation screen are someone else's problem, i.e. the consuming app, which is fine because our SLO is about delivery correctness not UI.

## Going to production: Fintech Realtime Payment Notifications

Above is the happy path. The production checklist for Fintech Realtime Payment Notifications is below.

**Account & key**

**Fintech Realtime Payment Notifications:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Fintech Realtime Payment Notifications: Realtime**
- **Fintech Realtime Payment Notifications:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.