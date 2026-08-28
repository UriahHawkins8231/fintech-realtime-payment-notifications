import assert from "node:assert/strict";
import test from "node:test";
import { decidePaymentNotification } from "../src/payment_policy.js";

test("an elevated-risk payment requires confirmation in the authenticated app", () => {
  const notification = decidePaymentNotification({
    paymentId: "pay-9001",
    userId: "user-42",
    accountId: "account-7",
    amountMinor: 125_00,
    currency: "USD",
    merchantName: "Northwind Travel",
    riskScore: 82,
    occurredAt: "2026-08-27T09:30:00.000Z"
  });

  assert.equal(notification.event, "payment.review_required");
  assert.equal(notification.data.audit.decision, "confirm_in_app");
  assert.equal(notification.data.audit.riskBand, "elevated");
  assert.match(notification.data.body, /Open the app/);
});
