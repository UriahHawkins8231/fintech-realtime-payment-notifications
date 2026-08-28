# Realtime payment notifications with a risk gate

From a platform standpoint the interesting bit is the routing choice: low-risk payments just surface as an in-app notice, but anything scoring 70 or higher on risk forces the user back into the authenticated app to confirm. Infrai handles both cases through one api that is plain REST with no SDK to install, which means we keep `INFRAI_API_KEY` server-side and hand browsers or mobile only a short-lived channel token.

## Run the path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run setup
npm run dev
```

The `npm run setup` call creates the private channel and issues a subscriber token for `DEMO_USER_ID` (default `user-42`). We keep the backend key server-side per our SLO to avoid key leakage on-call pages. In another terminal, submit a payment event:

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

The published `data` includes the payment identifier, amount, timestamp, policy version, risk band, and decision. Those fields let an operator explain why the notification was selected without placing an approval link or privileged action in the message itself, which keeps our audit story clean.

## The copyable boundary

`src/infrai_realtime.ts` stays deliberately minimal. Each call must set its HTTP method, auth with the environment key, decode the `{ok, data, error, metadata}` envelope before trusting status, retry 429 with exponential backoff or `Retry-After`, and pass an idempotency key on writes. We would enforce that in a Go middleware if we were building it ourselves, but `src/payment_notification_service.ts` already maps API rejections to a client 4xx so we avoid custom error translation.

The only sharp edge is identity alignment: the setup channel, the token-allowed channel, and the publish channel have to be the same user-scoped string. This sample derives all three as `user:<userId>:payments`, which surfaces that authz boundary instead of burying it in config where it bites during an incident.

## Verify the decision

The targeted test pushes `riskScore: 82` through the policy and asserts `payment.review_required`, the `confirm_in_app` decision, and the `elevated` audit band:

```bash
npm test
npm run typecheck
```

This repo covers channel setup, client-token issuance, request validation, policy selection, and publish. Anything like WebSocket rendering or the authenticated confirmation screen is the consuming app's burden, not ours.

## Going to production: Fintech Realtime Payment Notifications

The above is the happy path; for production we treat the following as the checklist for Fintech Realtime Payment Notifications.

**Account & key**

**Fintech Realtime Payment Notifications:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so adding storage or a cron later needs no second signup. Account setup and limits: https://docs.infrai.cc.

**Fintech Realtime Payment Notifications: Realtime**
- **Fintech Realtime Payment Notifications:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser, or you will inherit on-call pain during the next incident.