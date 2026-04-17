import { Injectable, ConflictException, NotFoundException, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { MercadoPagoService } from './mercadopago.service'

/**
 * Subscriptions business logic. Two entry points worth understanding:
 *
 *  1. `subscribe()` — called from the dashboard. Creates (or revives) an MP
 *     preapproval for the tenant and returns the `init_point` URL so the
 *     frontend can redirect the admin to MP's checkout. Does NOT extend the
 *     tenant's membership yet — that happens only when MP confirms the first
 *     payment via webhook.
 *
 *  2. `handlePaymentWebhook()` — called by `WebhooksController` after signature
 *     verification. Records the payment (idempotent on `mpPaymentId`) and, if
 *     approved, extends the tenant's `membershipExpiresAt` by 30 days.
 *
 * Money should only move through the second path. Never extend membership
 * from the first path or you open a trivial fraud: create preapproval, never
 * pay, keep free access.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name)

  constructor(
    private prisma: PrismaService,
    private mp: MercadoPagoService,
    private config: ConfigService,
  ) {}

  /**
   * Start (or restart) a subscription for a tenant. Returns the MP init_point
   * URL the caller should redirect to. If the tenant already has a pending or
   * authorized subscription we reuse it — MP de-duplicates by payer_email so
   * creating a second one would error out anyway.
   */
  async subscribe(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where:   { id: tenantId },
      include: { users: { where: { role: 'ADMIN' }, include: { user: true }, take: 1 } },
    })
    if (!tenant) throw new NotFoundException('Tenant not found')

    const adminEmail = tenant.users[0]?.user?.email
    if (!adminEmail) throw new BadRequestException('Tenant has no admin user to bill')

    // If an active-ish subscription already exists, reuse its init_point so
    // the admin can finish a previously-abandoned checkout. Cancelled ones
    // are replaced with a fresh preapproval.
    const existing = await this.prisma.subscription.findUnique({ where: { tenantId } })
    if (existing && ['pending', 'authorized'].includes(existing.status) && existing.initPoint) {
      return { initPoint: existing.initPoint, subscriptionId: existing.id, reused: true }
    }
    if (existing && existing.status === 'cancelled') {
      // Hard delete so the (unique) tenantId constraint lets us create a new
      // row. Payments remain because subscriptionId FK is SetNull.
      await this.prisma.subscription.delete({ where: { id: existing.id } })
    }

    // MP rejects http/localhost back_urls. Allow an override via MP_BACK_URL
    // so local dev can point at an ngrok tunnel (or the prod dashboard URL as
    // a temporary placeholder). Falls back to WEB_URL for prod.
    const backUrl = this.config.get<string>('MP_BACK_URL')
                 ?? `${this.config.get<string>('WEB_URL')}/dashboard/suscripcion/callback`
    const planId  = this.config.get<string>('MP_PLAN_ID') || null

    const mpResponse = await this.mp.createPreapproval({
      payerEmail: adminEmail,
      backUrl,
      tenantId,
      amount:     60_000,
      currency:   'ARS',
      reason:     `Suscripción TurnIT Estándar — ${tenant.name}`,
    })

    const amount   = mpResponse.auto_recurring?.transaction_amount ?? 60_000
    const currency = mpResponse.auto_recurring?.currency_id ?? 'ARS'

    const sub = await this.prisma.subscription.create({
      data: {
        tenantId,
        mpPreapprovalId: mpResponse.id!,
        mpPlanId:        planId,
        status:          mpResponse.status ?? 'pending',
        amount,
        currency,
        frequency:       mpResponse.auto_recurring?.frequency ?? 1,
        frequencyType:   mpResponse.auto_recurring?.frequency_type ?? 'months',
        payerEmail:      adminEmail,
        initPoint:       mpResponse.init_point ?? null,
        nextPaymentDate: mpResponse.next_payment_date ? new Date(mpResponse.next_payment_date) : null,
      },
    })

    return { initPoint: mpResponse.init_point, subscriptionId: sub.id, reused: false }
  }

  async getMySubscription(tenantId: string) {
    return this.prisma.subscription.findUnique({
      where:   { tenantId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take:    10,
        },
      },
    })
  }

  async cancel(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } })
    if (!sub) throw new NotFoundException('No active subscription')
    if (sub.status === 'cancelled') throw new ConflictException('Subscription already cancelled')

    await this.mp.cancelPreapproval(sub.mpPreapprovalId)

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data:  { status: 'cancelled', cancelledAt: new Date() },
    })
  }

  // ── Webhook handling ────────────────────────────────────────────────────

  /**
   * Handle a `payment.*` webhook from MP. We refetch the payment from MP (the
   * webhook body only contains the id) and upsert a Payment row. If the
   * payment is approved and tied to one of our subscriptions, we extend
   * membership by 30 days.
   *
   * Idempotency: mpPaymentId is a unique column + we use upsert, so replaying
   * the same webhook is a no-op.
   */
  async handlePaymentWebhook(mpPaymentId: string) {
    const payment = await this.mp.getPayment(mpPaymentId)
    if (!payment || !payment.id) {
      this.logger.warn(`Payment ${mpPaymentId} not found in MP`)
      return
    }

    // Preapproval payments carry the subscription id via `metadata.preapproval_id`
    // in newer SDKs, or at the top-level `preapproval_id` depending on the
    // event path. Try both.
    const preapprovalId: string | undefined =
      (payment as any).preapproval_id ??
      (payment as any).metadata?.preapproval_id ??
      undefined

    let sub = null
    let tenantId: string | undefined =
      (payment.external_reference as string | undefined) ?? undefined

    if (preapprovalId) {
      sub = await this.prisma.subscription.findUnique({ where: { mpPreapprovalId: preapprovalId } })
      if (sub) tenantId = sub.tenantId
    }

    if (!tenantId) {
      this.logger.warn(`Payment ${mpPaymentId} has no external_reference and no matching subscription — skipping`)
      return
    }

    const paidAt = payment.date_approved ? new Date(payment.date_approved)
                 : payment.date_created ? new Date(payment.date_created)
                 : null

    await this.prisma.payment.upsert({
      where:  { mpPaymentId: String(payment.id) },
      create: {
        tenantId,
        subscriptionId: sub?.id ?? null,
        mpPaymentId:    String(payment.id),
        status:         payment.status ?? 'unknown',
        statusDetail:   payment.status_detail ?? null,
        amount:         payment.transaction_amount ?? 0,
        currency:       payment.currency_id ?? 'ARS',
        paymentMethod:  payment.payment_method_id ?? null,
        paymentType:    payment.payment_type_id ?? null,
        paidAt,
        rawPayload:     payment as any,
      },
      update: {
        status:       payment.status ?? 'unknown',
        statusDetail: payment.status_detail ?? null,
        paidAt,
        rawPayload:   payment as any,
      },
    })

    if (payment.status === 'approved' && sub) {
      // Extend membership by 30 days from whichever is later: current expiry
      // or today. That way a tenant who pays BEFORE the trial runs out gets
      // the full value of the remaining trial + 30d on top.
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } })
      const now = new Date()
      const base = tenant?.membershipExpiresAt && tenant.membershipExpiresAt > now
                 ? tenant.membershipExpiresAt
                 : now
      const newExpiry = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data:  {
          membershipExpiresAt: newExpiry,
          plan:                'standard',
          isActive:            true,
        },
      })

      if (sub.status !== 'authorized') {
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data:  { status: 'authorized' },
        })
      }
    }
  }

  /**
   * Handle a `preapproval.*` webhook. We mostly use this to mirror
   * cancellation/pause state back into our DB so the UI reflects reality.
   */
  async handlePreapprovalWebhook(mpPreapprovalId: string) {
    const pre = await this.mp.getPreapproval(mpPreapprovalId)
    if (!pre || !pre.id) return

    const sub = await this.prisma.subscription.findUnique({ where: { mpPreapprovalId } })
    if (!sub) {
      this.logger.warn(`Preapproval ${mpPreapprovalId} webhook but no local row`)
      return
    }

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data:  {
        status:          pre.status ?? sub.status,
        nextPaymentDate: pre.next_payment_date ? new Date(pre.next_payment_date) : sub.nextPaymentDate,
        cancelledAt:     pre.status === 'cancelled' && !sub.cancelledAt ? new Date() : sub.cancelledAt,
      },
    })
  }

  // ── SuperAdmin queries ──────────────────────────────────────────────────

  async adminListPayments(filters: { tenantId?: string; status?: string; from?: Date; to?: Date } = {}) {
    return this.prisma.payment.findMany({
      where: {
        tenantId:  filters.tenantId,
        status:    filters.status,
        createdAt: {
          gte: filters.from,
          lte: filters.to,
        },
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take:    500,
    })
  }

  async adminMetrics() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOf30d   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [approvedThisMonth, activeSubs, failed30d] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'approved', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.subscription.count({ where: { status: 'authorized' } }),
      this.prisma.payment.count({
        where: { status: { in: ['rejected', 'cancelled'] }, createdAt: { gte: startOf30d } },
      }),
    ])

    const mrr = activeSubs * 60_000

    return {
      mrr,
      activeSubscriptions: activeSubs,
      collectedThisMonth:  Number(approvedThisMonth._sum.amount ?? 0),
      paymentsThisMonth:   approvedThisMonth._count,
      failedLast30d:       failed30d,
    }
  }
}
