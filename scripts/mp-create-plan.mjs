#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// One-shot script: create the Mercado Pago preapproval plan that every tenant
// subscribes to. Run once per environment (test and prod separately) and save
// the printed plan id into apps/api/.env as MP_PLAN_ID.
//
// Usage:
//   MP_ACCESS_TOKEN="TEST-..." node scripts/mp-create-plan.mjs
//
// If you ever need to change the price, don't edit an existing plan — MP only
// lets you update a few fields and the history gets confusing. Create a new
// plan and flip MP_PLAN_ID. Existing subscribers keep the old plan's price
// (that's MP's behaviour, not ours) until they re-subscribe.
// ─────────────────────────────────────────────────────────────────────────────

import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago'

const accessToken = process.env.MP_ACCESS_TOKEN
if (!accessToken) {
  console.error('ERROR: MP_ACCESS_TOKEN env var is required')
  process.exit(1)
}

const backUrl = process.env.MP_BACK_URL ?? 'http://localhost:3000/dashboard/suscripcion/callback'

const client = new MercadoPagoConfig({ accessToken })
const plans  = new PreApprovalPlan(client)

const body = {
  reason: 'Suscripción TurnIT Estándar',
  auto_recurring: {
    frequency:          1,
    frequency_type:     'months',
    transaction_amount: 60,
    currency_id:        'ARS',
  },
  back_url:        backUrl,
  payment_methods_allowed: {
    payment_types:   [{ id: 'credit_card' }, { id: 'debit_card' }],
    payment_methods: [],
  },
}

try {
  const plan = await plans.create({ body })
  console.log('\n✅ Plan created')
  console.log('─'.repeat(50))
  console.log('Plan ID :', plan.id)
  console.log('Status  :', plan.status)
  console.log('Amount  :', plan.auto_recurring?.transaction_amount, plan.auto_recurring?.currency_id)
  console.log('Init URL:', plan.init_point)
  console.log('─'.repeat(50))
  console.log('\nAdd this to apps/api/.env:')
  console.log(`MP_PLAN_ID=${plan.id}\n`)
} catch (err) {
  console.error('❌ Failed to create plan:')
  console.error(err?.message ?? err)
  if (err?.cause) console.error('Cause:', err.cause)
  process.exit(1)
}
