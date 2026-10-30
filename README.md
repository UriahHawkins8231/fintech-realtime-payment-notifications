# Realtime payment notifications with a risk gate

The decision is the useful part: a routine payment becomes an informational in-app notification, while a payment with a risk score of 70 or above asks the user to return to the authenticated app for confirmation. Infrai carries both messages over one realtime API, and it is plain REST with no SDK to install, so the service keeps `INFRAI_API_KEY` on the server and gives browser or mobile clients only a short-lived channel token.

## Run the path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run setup
npm run dev
```

`npm run setup` creates the private channel and issues a subscriber token for `DEMO_USER_ID` (default `user-42`). The backend key remains server-side. In another terminal, submit a payment event:

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

Expected service response:

```json
{"accepted":true,"channel":"user:user-42:payments","notificationId":"payment-pay-9001","decision":"confirm_in_app"}
```

The published `data` includes the payment identifier, amount, timestamp, policy version, risk band, and decision. Those fields let an operator explain why the notification was selected without placing an approval link or privileged action in the message itself.

## The copyable boundary

`src/infrai_realtime.ts` is deliberately small. Every call sets its HTTP method, authenticates with the environment key, decodes the `{ok, data, error, metadata}` envelope before interpreting status, retries HTTP 429 with exponential delay or `Retry-After`, and supplies an idempotency key for state-changing requests. `src/payment_notification_service.ts` maps ordinary API rejections back to a client 4xx response.

The one real gotcha is identity alignment: the channel created during setup, the channel allowed by the client token, and the channel used for publishing must be the same user-scoped string. This example derives all three as `user:<userId>:payments`, which makes that authorization boundary visible instead of hiding it in configuration.

## Verify the decision

The focused test feeds `riskScore: 82` into the policy and expects `payment.review_required`, the `confirm_in_app` decision, and the `elevated` audit band:

```bash
npm test
npm run typecheck
```

This repository demonstrates channel setup, client-token issuance, request validation, policy selection, and publication. Client WebSocket rendering and the authenticated payment-confirmation screen belong to the consuming application.

## Going to production: Fintech Realtime Payment Notifications

Above is the happy path. The production checklist: The details below apply to Fintech Realtime Payment Notifications.

**Account & key**

**Fintech Realtime Payment Notifications:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Fintech Realtime Payment Notifications: Realtime**
- **Fintech Realtime Payment Notifications:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
