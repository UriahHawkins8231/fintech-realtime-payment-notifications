import { z } from "zod";

export const paymentEventSchema = z.object({
  paymentId: z.string().min(1),
  userId: z.string().min(1),
  accountId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  merchantName: z.string().min(1),
  riskScore: z.number().min(0).max(100),
  occurredAt: z.string().datetime()
});

export type PaymentEvent = z.infer<typeof paymentEventSchema>;

export type PaymentNotification = {
  event: "payment.posted" | "payment.review_required";
  data: {
    notificationId: string;
    paymentId: string;
    title: string;
    body: string;
    amountMinor: number;
    currency: string;
    occurredAt: string;
    audit: {
      policy: "payment-risk-v1";
      decision: "inform" | "confirm_in_app";
      riskBand: "standard" | "elevated";
    };
  };
};

export function decidePaymentNotification(payment: PaymentEvent): PaymentNotification {
  const elevated = payment.riskScore >= 70;
  return {
    event: elevated ? "payment.review_required" : "payment.posted",
    data: {
      notificationId: `payment-${payment.paymentId}`,
      paymentId: payment.paymentId,
      title: elevated ? "Confirm this payment" : "Payment completed",
      body: elevated
        ? `Open the app to review the payment at ${payment.merchantName}.`
        : `Your payment at ${payment.merchantName} is complete.`,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      occurredAt: payment.occurredAt,
      audit: {
        policy: "payment-risk-v1",
        decision: elevated ? "confirm_in_app" : "inform",
        riskBand: elevated ? "elevated" : "standard"
      }
    }
  };
}
