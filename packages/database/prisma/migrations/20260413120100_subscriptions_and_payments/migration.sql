-- Subscription (one per tenant, mirrors MP preapproval)
CREATE TABLE "subscriptions" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "mpPreapprovalId" TEXT NOT NULL,
    "mpPlanId"        TEXT,
    "status"          TEXT NOT NULL,
    "amount"          DECIMAL(10,2) NOT NULL,
    "currency"        TEXT NOT NULL DEFAULT 'ARS',
    "frequency"       INTEGER NOT NULL DEFAULT 1,
    "frequencyType"   TEXT NOT NULL DEFAULT 'months',
    "payerEmail"      TEXT NOT NULL,
    "initPoint"       TEXT,
    "nextPaymentDate" TIMESTAMP(3),
    "cancelledAt"     TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_tenantId_key"        ON "subscriptions"("tenantId");
CREATE UNIQUE INDEX "subscriptions_mpPreapprovalId_key" ON "subscriptions"("mpPreapprovalId");
CREATE INDEX        "subscriptions_status_idx"          ON "subscriptions"("status");

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payment (immutable log of MP payment events, per tenant)
CREATE TABLE "payments" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "subscriptionId" TEXT,
    "mpPaymentId"    TEXT NOT NULL,
    "status"         TEXT NOT NULL,
    "statusDetail"   TEXT,
    "amount"         DECIMAL(10,2) NOT NULL,
    "currency"       TEXT NOT NULL DEFAULT 'ARS',
    "paymentMethod"  TEXT,
    "paymentType"    TEXT,
    "paidAt"         TIMESTAMP(3),
    "rawPayload"     JSONB NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_mpPaymentId_key"        ON "payments"("mpPaymentId");
CREATE INDEX        "payments_tenantId_createdAt_idx" ON "payments"("tenantId","createdAt");
CREATE INDEX        "payments_status_idx"             ON "payments"("status");
CREATE INDEX        "payments_paidAt_idx"             ON "payments"("paidAt");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
